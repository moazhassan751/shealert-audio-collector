import json
import logging
import shutil
import subprocess
import wave
from pathlib import Path

logger = logging.getLogger(__name__)


class AudioError(ValueError):
    pass


import os

_binary_cache: dict[str, str] = {}


def resolve_binary(name: str, configured_path: str = "") -> str:
    cache_key = f"{name}:{configured_path}"
    if cache_key in _binary_cache:
        return _binary_cache[cache_key]
    if configured_path and Path(configured_path).is_file():
        _binary_cache[cache_key] = configured_path
        return configured_path
    if configured_path:
        found_cfg = shutil.which(configured_path)
        if found_cfg:
            _binary_cache[cache_key] = found_cfg
            return found_cfg
    found = shutil.which(name)
    if found:
        _binary_cache[cache_key] = found
        return found
    localappdata = os.environ.get("LOCALAPPDATA", "")
    if localappdata:
        winget_path = Path(localappdata) / "Microsoft" / "WinGet" / "Packages"
        if winget_path.exists():
            for p in winget_path.glob(f"**/{name}.exe"):
                if p.is_file():
                    _binary_cache[cache_key] = str(p)
                    return str(p)
    result = configured_path or name
    _binary_cache[cache_key] = result
    return result


def run_ffprobe(ffmpeg_path: str, source: Path) -> tuple[float, int, int]:
    ffprobe = resolve_binary("ffprobe")
    if not ffprobe:
        return 0.0, 0, 0
    command = [ffprobe, "-v", "error", "-show_entries", "format=duration:stream=sample_rate,channels", "-of", "json", str(source)]
    result = subprocess.run(command, capture_output=True, text=True, timeout=30, check=False)
    if result.returncode != 0:
        raise AudioError("The audio could not be decoded.")
    try:
        payload = json.loads(result.stdout)
        duration = float(payload.get("format", {}).get("duration") or 0)
        stream = next((item for item in payload.get("streams", []) if "sample_rate" in item), {})
        return duration, int(stream.get("sample_rate") or 0), int(stream.get("channels") or 0)
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise AudioError("The audio metadata is invalid.") from exc


def convert_to_standard_wav(source: Path, destination: Path, ffmpeg_path: str, min_duration: float) -> tuple[float, int, int]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg = resolve_binary("ffmpeg", ffmpeg_path)
    command = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
        "-ac", "1", "-ar", "16000", "-sample_fmt", "s16", str(destination),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=120, check=False)
    if result.returncode != 0 or not destination.exists() or destination.stat().st_size < 44:
        raise AudioError("FFmpeg could not create a standardized WAV file.")
    duration, sample_rate, channels = wav_details(destination)
    if duration < min_duration:
        raise AudioError(f"Recording must be at least {min_duration:g} seconds long.")
    if sample_rate != 16000 or channels != 1:
        raise AudioError("Standardized audio did not meet the 16 kHz mono requirement.")
    if is_silent(destination):
        raise AudioError("The recording appears to contain no audible signal.")
    return duration, sample_rate, channels


def wav_details(path: Path) -> tuple[float, int, int]:
    try:
        with wave.open(str(path), "rb") as handle:
            frames = handle.getnframes()
            rate = handle.getframerate()
            channels = handle.getnchannels()
            return frames / rate if rate else 0.0, rate, channels
    except (wave.Error, EOFError) as exc:
        raise AudioError("The WAV file is invalid.") from exc


def is_silent(path: Path) -> bool:
    try:
        with wave.open(str(path), "rb") as handle:
            data = handle.readframes(handle.getnframes())
            sample_width = handle.getsampwidth()
        if not data or sample_width not in (1, 2, 4):
            return True
        if sample_width == 2:
            return max(abs(int.from_bytes(data[index:index + 2], "little", signed=True)) for index in range(0, len(data) - 1, 2)) == 0
        return all(byte == 0 for byte in data)
    except (wave.Error, EOFError):
        return True

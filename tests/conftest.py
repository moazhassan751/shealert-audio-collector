import math
import struct
import sys
import wave
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path
backend_path = Path(__file__).resolve().parents[1] / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app.config import Settings
from app.storage import DatasetStore
import app.main as main_module
from app.main import app


def generate_wav(
    filepath: Path,
    duration: float = 2.0,
    sample_rate: int = 16000,
    frequency: float = 440.0,
    amplitude: int = 16000,
) -> Path:
    """Generate a 16-bit mono PCM WAV file with a pure sine tone or silence."""
    num_samples = int(duration * sample_rate)
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(filepath), "w") as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        
        frames = bytearray()
        for i in range(num_samples):
            if amplitude == 0:
                value = 0
            else:
                value = int(amplitude * math.sin(2 * math.pi * frequency * i / sample_rate))
            frames.extend(struct.pack("<h", value))
        wav_file.writeframes(frames)
    return filepath


@pytest.fixture
def audio_files(tmp_path):
    """Fixture producing various test audio files."""
    audio_dir = tmp_path / "audio_samples"
    audio_dir.mkdir(parents=True, exist_ok=True)
    
    valid_wav = generate_wav(audio_dir / "valid_sample.wav", duration=2.0, frequency=440.0, amplitude=16000)
    silent_wav = generate_wav(audio_dir / "silent_sample.wav", duration=2.0, amplitude=0)
    short_wav = generate_wav(audio_dir / "short_sample.wav", duration=0.5, frequency=440.0, amplitude=16000)
    
    corrupt_file = audio_dir / "corrupt.wav"
    corrupt_file.write_bytes(b"RIFF\x00\x00\x00\x00WAVEfmt \x10\x00\x00\x00not-a-valid-pcm-data-header-corrupt")
    
    return {
        "valid": valid_wav,
        "silent": silent_wav,
        "short": short_wav,
        "corrupt": corrupt_file,
    }


@pytest.fixture
def isolated_store(tmp_path, monkeypatch):
    """Fixture providing isolated storage sandbox for tests."""
    dataset_dir = tmp_path / "dataset"
    data_dir = tmp_path / "data"
    temp_dir = tmp_path / "temp"

    test_settings = Settings(
        admin_password="test-secret-password",
        frontend_origins="http://localhost:5173",
        data_root=dataset_dir,
        data_file_root=data_dir,
        temp_root=temp_dir,
        min_duration_seconds=1.0,
        google_drive_required=False,
    )

    store = DatasetStore(test_settings, drive=None, sheets=None)
    monkeypatch.setattr(main_module, "settings", test_settings)
    monkeypatch.setattr(main_module, "store", store)
    monkeypatch.setattr(main_module, "drive", None)
    monkeypatch.setattr(main_module, "sheets", None)

    # Clear state between tests
    main_module.active_reservations.clear()
    main_module.tokens.clear()

    return {
        "store": store,
        "settings": test_settings,
        "dataset_dir": dataset_dir,
        "data_dir": data_dir,
        "temp_dir": temp_dir,
    }


@pytest.fixture
def client(isolated_store):
    """FastAPI TestClient hooked to isolated storage."""
    with TestClient(app) as test_client:
        yield test_client

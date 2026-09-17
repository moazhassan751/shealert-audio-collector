import pytest
from pathlib import Path
from app.audio import AudioError, convert_to_standard_wav, is_silent, wav_details, run_ffprobe


def test_wav_details_valid(audio_files):
    """Test extracting duration, rate, and channels from a valid WAV."""
    duration, rate, channels = wav_details(audio_files["valid"])
    assert 1.99 <= duration <= 2.01
    assert rate == 16000
    assert channels == 1


def test_is_silent_detection(audio_files):
    """Test that silence detection differentiates between tone and silence."""
    assert is_silent(audio_files["silent"]) is True
    assert is_silent(audio_files["valid"]) is False


def test_convert_to_standard_wav_success(audio_files, tmp_path, isolated_store):
    """Test standardizing a valid audio file to 16 kHz mono WAV."""
    dest = tmp_path / "output_standard.wav"
    duration, rate, channels = convert_to_standard_wav(
        audio_files["valid"],
        dest,
        ffmpeg_path=isolated_store["settings"].ffmpeg_path,
        min_duration=1.0,
    )
    assert dest.exists()
    assert 1.99 <= duration <= 2.01
    assert rate == 16000
    assert channels == 1
    assert not is_silent(dest)


def test_convert_to_standard_wav_rejects_silent(audio_files, tmp_path, isolated_store):
    """Test that conversion rejects silent recordings."""
    dest = tmp_path / "output_silent.wav"
    with pytest.raises(AudioError, match="no audible signal"):
        convert_to_standard_wav(
            audio_files["silent"],
            dest,
            ffmpeg_path=isolated_store["settings"].ffmpeg_path,
            min_duration=1.0,
        )


def test_convert_to_standard_wav_rejects_short(audio_files, tmp_path, isolated_store):
    """Test that conversion rejects clips under the minimum duration threshold."""
    dest = tmp_path / "output_short.wav"
    with pytest.raises(AudioError, match="at least 1"):
        convert_to_standard_wav(
            audio_files["short"],
            dest,
            ffmpeg_path=isolated_store["settings"].ffmpeg_path,
            min_duration=1.0,
        )


def test_convert_to_standard_wav_rejects_corrupted(audio_files, tmp_path, isolated_store):
    """Test that conversion fails gracefully for corrupted files."""
    dest = tmp_path / "output_corrupt.wav"
    with pytest.raises(AudioError):
        convert_to_standard_wav(
            audio_files["corrupt"],
            dest,
            ffmpeg_path=isolated_store["settings"].ffmpeg_path,
            min_duration=1.0,
        )

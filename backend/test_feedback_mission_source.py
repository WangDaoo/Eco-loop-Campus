from pathlib import Path


def test_admin_resolved_bin_full_feedback_triggers_backend_mission_event():
    source = (Path(__file__).resolve().parent / "app.py").read_text(encoding="utf-8")

    assert "feedback_bin_full_resolved" in source
    assert "apply_mission_event" in source
    assert "category = 'bin_full'" in source

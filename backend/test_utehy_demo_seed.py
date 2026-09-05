import app


def test_utehy_demo_seed_builds_realistic_records_for_admin_tables():
    from local_db.seed_utehy_demo_data import build_demo_dataset

    dataset = build_demo_dataset()

    assert len(dataset["users"]) >= 16
    assert len(dataset["bins"]) >= 8
    assert len(dataset["waste_types"]) >= 6
    assert len(dataset["avatar_presets"]) >= 6
    assert len(dataset["reward_categories"]) >= 5
    assert len(dataset["rewards"]) >= 6
    assert len(dataset["missions"]) >= 5
    assert len(dataset["point_rules"]) >= 6
    assert len(dataset["predictions"]) >= 8
    assert len(dataset["recycling_submissions"]) >= 8
    assert len(dataset["qr_scan_logs"]) >= 8
    assert len(dataset["proof_images"]) >= 4
    assert len(dataset["point_history"]) >= 8
    assert len(dataset["reward_redemptions"]) >= 4
    assert len(dataset["feedback"]) >= 5
    assert len(dataset["user_missions"]) >= 8
    assert dataset["settings"]["id"] == "main"


def test_utehy_demo_seed_uses_prefix_and_hashed_passwords():
    from local_db.seed_utehy_demo_data import TEMPORARY_PASSWORD, build_demo_dataset

    dataset = build_demo_dataset()

    assert TEMPORARY_PASSWORD == "123456"
    for user in dataset["users"]:
        assert user["id"].startswith("UTEHY_")
        assert user["email"].endswith("@utehy.edu.vn")
        assert user["password_hash"] != TEMPORARY_PASSWORD
        assert app.verify_password(TEMPORARY_PASSWORD, user["password_hash"])
        if user["role"] in {"student", "volunteer"}:
            assert user["student_code"]
            assert user["faculty_code"]
            assert user["phone_number"]
            assert user["group"].startswith("Khoa ")


def test_utehy_demo_seed_accepts_runtime_password_override(monkeypatch):
    from local_db import seed_utehy_demo_data

    uat_password = "Uat-Only-Password-2026"
    monkeypatch.setenv("ECOLOOP_DEMO_PASSWORD", uat_password)

    dataset = seed_utehy_demo_data.build_demo_dataset()

    assert all(app.verify_password(uat_password, user["password_hash"]) for user in dataset["users"])
    assert all(not app.verify_password(seed_utehy_demo_data.TEMPORARY_PASSWORD, user["password_hash"]) for user in dataset["users"])


def test_utehy_demo_seed_does_not_print_runtime_password(monkeypatch, capsys):
    from local_db import seed_utehy_demo_data

    uat_password = "Uat-Secret-Must-Not-Appear"
    monkeypatch.setenv("ECOLOOP_DEMO_PASSWORD", uat_password)
    monkeypatch.setattr("sys.argv", ["seed_utehy_demo_data.py", "--dry-run"])

    seed_utehy_demo_data.main()

    assert uat_password not in capsys.readouterr().out


def test_utehy_demo_seed_has_finite_reward_stock_for_uat_inventory_flow():
    from local_db.seed_utehy_demo_data import build_demo_dataset

    rewards = {reward["id"]: reward for reward in build_demo_dataset()["rewards"]}

    assert rewards["UTEHY_REWARD_BADGE"]["stock"] == 30
    assert all(isinstance(reward["stock"], int) and reward["stock"] >= 0 for reward in rewards.values())


def test_utehy_demo_seed_cleanup_sql_targets_only_e2e_data():
    from local_db.seed_utehy_demo_data import E2E_CLEANUP_SQL

    lowered = E2E_CLEANUP_SQL.lower()

    assert "delete from users" in lowered
    assert "e2e\\_%" in lowered
    assert "delete from bins" in lowered
    assert "delete from waste_types" in lowered
    assert "truncate" not in lowered
    assert "delete from users;" not in lowered

def test_utehy_demo_cleanup_sql_targets_only_seeded_data():
    from local_db.seed_utehy_demo_data import UTEHY_DEMO_CLEANUP_SQL

    lowered = UTEHY_DEMO_CLEANUP_SQL.lower()

    assert "utehy\\_%" in lowered
    assert "utehy_demo_seed" in lowered
    assert "delete from users" in lowered
    assert "delete from bins" in lowered
    assert "delete from reward_categories" in lowered
    assert "delete from rewards;" not in lowered
    assert "delete from users;" not in lowered
    assert "truncate" not in lowered

def test_utehy_demo_cleanup_upload_files_uses_backend_upload_root(tmp_path, monkeypatch):
    from local_db import seed_utehy_demo_data

    assert hasattr(seed_utehy_demo_data, "UPLOADS_DIR")
    monkeypatch.setattr(seed_utehy_demo_data, "UPLOADS_DIR", tmp_path)
    avatar_dir = tmp_path / "avatars"
    avatar_dir.mkdir()
    demo_file = avatar_dir / "utehy-avatar-test.svg"
    real_file = avatar_dir / "custom-avatar.svg"
    demo_file.write_text("<svg />", encoding="utf-8")
    real_file.write_text("<svg />", encoding="utf-8")

    assert seed_utehy_demo_data.remove_demo_upload_files() == 1
    assert not demo_file.exists()
    assert real_file.exists()


def test_utehy_demo_seed_upserts_instead_of_creating_duplicates():
    from local_db.seed_utehy_demo_data import UPSERT_SQL

    for table in ["users", "bins", "waste_types", "avatar_presets", "reward_categories", "rewards", "missions", "settings"]:
        assert table in UPSERT_SQL
    assert UPSERT_SQL.count("on conflict") >= 7

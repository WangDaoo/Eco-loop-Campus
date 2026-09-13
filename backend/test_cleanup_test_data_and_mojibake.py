def test_cleanup_patterns_target_test_rows_without_wide_delete():
    from local_db.cleanup_test_data_and_mojibake import TEST_DATA_CLEANUP_SQL

    lowered = TEST_DATA_CLEANUP_SQL.lower()

    assert "lower(email) like 'e2e%'" in lowered
    assert "lower(name) like 'e2e%'" in lowered
    assert "lower(image_name) like 'e2e%'" in lowered
    assert "student.e2e@hyute.edu.vn" in lowered
    assert "utehy_demo_seed" in lowered
    assert "truncate" not in lowered
    assert "delete from users;" not in lowered
    assert "delete from predictions;" not in lowered


def test_mojibake_fix_cleans_known_database_strings():
    from local_db.cleanup_test_data_and_mojibake import fix_mojibake_text

    assert fix_mojibake_text("Khoa C?ng ngh? th?ng tin") == "Khoa Công nghệ thông tin"
    assert fix_mojibake_text("X?c nh?n QR t?i ch?") == "Xác nhận QR tái chế"
    assert fix_mojibake_text("C?ng ?i?m t? giao d?ch QR") == "Cộng điểm từ giao dịch QR"
    assert fix_mojibake_text("?i?u ch?nh") == "Điều chỉnh"
    assert fix_mojibake_text("Nhi?m v?") == "Nhiệm vụ"
    assert fix_mojibake_text("Ho?n th?nh nhi?m v? Gửi rác tái chế hôm nay") == "Hoàn thành nhiệm vụ Gửi rác tái chế hôm nay"


def test_mojibake_fix_cleans_known_faculty_names():
    from local_db.cleanup_test_data_and_mojibake import fix_mojibake_text

    assert fix_mojibake_text("Khoa C? kh?") == "Khoa Cơ khí"
    assert fix_mojibake_text("Khoa C? kh? ??ng l?c") == "Khoa Cơ khí động lực"
    assert fix_mojibake_text("Khoa ?i?n ? ?i?n t?") == "Khoa Điện - Điện tử"
    assert fix_mojibake_text("Khoa C?ng ngh? May v? Th?i trang") == "Khoa Công nghệ May và Thời trang"
    assert fix_mojibake_text("Khoa C?ng ngh? H?a h?c v? M?i tr??ng") == "Khoa Công nghệ Hóa học và Môi trường"
    assert fix_mojibake_text("Khoa Kinh t?") == "Khoa Kinh tế"
    assert fix_mojibake_text("Khoa Ngo?i ng?") == "Khoa Ngoại ngữ"
    assert fix_mojibake_text("Khoa S? ph?m K? thu?t") == "Khoa Sư phạm Kỹ thuật"
    assert fix_mojibake_text("Khoa Khoa h?c c? b?n") == "Khoa Khoa học cơ bản"
    assert fix_mojibake_text("Khoa L? lu?n ch?nh tr?") == "Khoa Lý luận chính trị"


def test_cleanup_preserves_seeded_reward_catalog_ids():
    from local_db.cleanup_test_data_and_mojibake import delete_specs

    reward_tables = {
        table_name: where_sql.lower()
        for table_name, where_sql in delete_specs()
        if table_name in {"reward_categories", "rewards", "reward_redemptions", "reward_redemption_items"}
    }

    assert "utehy\\_%" not in reward_tables["reward_categories"]
    assert "utehy\\_%" not in reward_tables["rewards"]
    assert "reward_id like 'utehy\\_%'" not in reward_tables["reward_redemptions"]
    assert "reward_id like 'utehy\\_%'" not in reward_tables["reward_redemption_items"]

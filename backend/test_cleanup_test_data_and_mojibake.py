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

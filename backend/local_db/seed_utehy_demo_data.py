import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

TEMPORARY_PASSWORD = "123456"
DEMO_PREFIX = "UTEHY_"
UPLOADS_DIR = app.UPLOADS_DIR

E2E_CLEANUP_SQL = r"""
delete from point_history
where source like 'E2E\_%' escape '\'
   or user_id in (select id from users where id like 'E2E\_%' escape '\' or email like 'E2E\_%' escape '\')
   or submission_id in (select id from recycling_submissions where id like 'E2E\_%' escape '\' or qr_token like 'E2E\_%' escape '\')
   or prediction_id in (select id from predictions where id like 'E2E\_%' escape '\');
delete from proof_images where id like 'E2E\_%' escape '\' or submission_id in (select id from recycling_submissions where id like 'E2E\_%' escape '\');
delete from qr_scan_logs where id like 'E2E\_%' escape '\' or qr_token like 'E2E\_%' escape '\';
delete from user_missions where id like 'E2E\_%' escape '\' or user_id in (select id from users where id like 'E2E\_%' escape '\');
delete from reward_redemptions where id like 'E2E\_%' escape '\' or user_id in (select id from users where id like 'E2E\_%' escape '\');
delete from recycling_submissions where id like 'E2E\_%' escape '\' or qr_token like 'E2E\_%' escape '\';
delete from predictions where id like 'E2E\_%' escape '\' or image_name like 'E2E\_%' escape '\';
delete from feedback where id like 'E2E\_%' escape '\' or user_name like 'E2E\_%' escape '\';
delete from users where id like 'E2E\_%' escape '\' or email like 'E2E\_%' escape '\';
delete from bins where id like 'E2E\_%' escape '\' or qr_code like 'E2E\_%' escape '\';
delete from waste_types where id like 'E2E\_%' escape '\';
delete from avatar_presets where key like 'E2E\_%' escape '\';
delete from rewards where id like 'E2E\_%' escape '\';
delete from reward_categories where id like 'E2E\_%' escape '\';
delete from missions where id like 'E2E\_%' escape '\';
"""

DEMO_REFRESH_SQL = r"""
delete from point_history where source = 'utehy_demo_seed';
"""

UTEHY_DEMO_CLEANUP_SQL = r"""
delete from point_history
where source = 'utehy_demo_seed'
   or user_id in (select id from users where id like 'UTEHY\_%' escape '\' or email like '%@utehy.edu.vn')
   or submission_id in (select id from recycling_submissions where id like 'UTEHY\_%' escape '\' or qr_token like 'ECL-SUB-UTEHY-%')
   or prediction_id in (select id from predictions where id like 'UTEHY\_%' escape '\');
delete from proof_images
where id like 'UTEHY\_%' escape '\'
   or image_url like '/uploads/proofs/utehy-%'
   or submission_id in (select id from recycling_submissions where id like 'UTEHY\_%' escape '\');
delete from qr_scan_logs
where id like 'UTEHY\_%' escape '\'
   or qr_token like 'ECL-SUB-UTEHY-%'
   or scanned_by in (select id from users where id like 'UTEHY\_%' escape '\')
   or station_id in (select id from bins where id like 'UTEHY\_%' escape '\');
delete from user_missions
where id like 'UTEHY\_%' escape '\'
   or user_id in (select id from users where id like 'UTEHY\_%' escape '\')
   or mission_id in (select id from missions where id like 'UTEHY\_%' escape '\');
delete from reward_redemptions
where id like 'UTEHY\_%' escape '\'
   or user_id in (select id from users where id like 'UTEHY\_%' escape '\')
   or reward_id in (select id from rewards where id like 'UTEHY\_%' escape '\');
delete from feedback
where id like 'UTEHY\_%' escape '\'
   or user_id in (select id from users where id like 'UTEHY\_%' escape '\')
   or bin_id in (select id from bins where id like 'UTEHY\_%' escape '\');
delete from recycling_submissions
where id like 'UTEHY\_%' escape '\'
   or qr_token like 'ECL-SUB-UTEHY-%'
   or user_id in (select id from users where id like 'UTEHY\_%' escape '\')
   or bin_id in (select id from bins where id like 'UTEHY\_%' escape '\')
   or waste_type_id in (select id from waste_types where id like 'UTEHY\_%' escape '\');
delete from predictions
where id like 'UTEHY\_%' escape '\'
   or image_name like 'utehy-%'
   or user_id in (select id from users where id like 'UTEHY\_%' escape '\')
   or bin_id in (select id from bins where id like 'UTEHY\_%' escape '\');
delete from rewards
where id like 'UTEHY\_%' escape '\'
   or category_id in (select id from reward_categories where id like 'UTEHY\_%' escape '\');
delete from reward_categories where id like 'UTEHY\_%' escape '\';
delete from point_rules where id like 'UTEHY\_%' escape '\';
delete from missions where id like 'UTEHY\_%' escape '\';
delete from users where id like 'UTEHY\_%' escape '\' or email like '%@utehy.edu.vn';
delete from bins where id like 'UTEHY\_%' escape '\' or qr_code like 'ECL-ST-UTEHY-%';
delete from waste_types where id like 'UTEHY\_%' escape '\';
delete from avatar_presets where key like 'UTEHY\_%' escape '\' or image_url like '/uploads/avatars/utehy-%';
update settings
set threshold = 0.65,
    model_name = 'MobileNetV2',
    class_count = 10,
    updated_at = now()
where id = 'main' and model_name like '%UTEHY%';
"""

UPSERT_SQL = """
insert into users (id, name, email, password_hash, role, "group", points, status, student_code, faculty_code, phone_number, avatar_key, avatar_url, updated_at)
values (%(id)s, %(name)s, %(email)s, %(password_hash)s, %(role)s, %(group)s, %(points)s, %(status)s, %(student_code)s, %(faculty_code)s, %(phone_number)s, %(avatar_key)s, %(avatar_url)s, now())
on conflict (email) do update set
  id = excluded.id,
  name = excluded.name,
  password_hash = excluded.password_hash,
  role = excluded.role,
  "group" = excluded."group",
  points = excluded.points,
  status = excluded.status,
  student_code = excluded.student_code,
  faculty_code = excluded.faculty_code,
  phone_number = excluded.phone_number,
  avatar_key = excluded.avatar_key,
  avatar_url = excluded.avatar_url,
  updated_at = now();

insert into avatar_presets (key, label, image_url, updated_at)
values (%(key)s, %(label)s, %(image_url)s, now())
on conflict (key) do update set label = excluded.label, image_url = excluded.image_url, updated_at = now();

insert into bins (id, name, bin_group, location, building, floor, qr_code, status, capacity, latitude, longitude, map_x, map_y, updated_at)
values (%(id)s, %(name)s, %(bin_group)s, %(location)s, %(building)s, %(floor)s, %(qr_code)s, %(status)s, %(capacity)s, %(latitude)s, %(longitude)s, %(map_x)s, %(map_y)s, now())
on conflict (id) do update set
  name = excluded.name,
  bin_group = excluded.bin_group,
  location = excluded.location,
  building = excluded.building,
  floor = excluded.floor,
  qr_code = excluded.qr_code,
  status = excluded.status,
  capacity = excluded.capacity,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  map_x = excluded.map_x,
  map_y = excluded.map_y,
  updated_at = now();

insert into waste_types (id, name, unit, point_per_unit, recycle_method, status, updated_at)
values (%(id)s, %(name)s, %(unit)s, %(point_per_unit)s, %(recycle_method)s, %(status)s, now())
on conflict (id) do update set
  name = excluded.name,
  unit = excluded.unit,
  point_per_unit = excluded.point_per_unit,
  recycle_method = excluded.recycle_method,
  status = excluded.status,
  updated_at = now();

insert into point_rules (id, label, class_keys, bin_group, points, enabled)
values (%(id)s, %(label)s, %(class_keys)s, %(bin_group)s, %(points)s, %(enabled)s)
on conflict (id) do update set
  label = excluded.label,
  class_keys = excluded.class_keys,
  bin_group = excluded.bin_group,
  points = excluded.points,
  enabled = excluded.enabled;

insert into reward_categories (id, name, description, status, color, updated_at)
values (%(id)s, %(name)s, %(description)s, %(status)s, %(color)s, now())
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  color = excluded.color,
  updated_at = now();

insert into rewards (id, title, description, category_id, category_name, cost_points, status, color, updated_at)
values (%(id)s, %(title)s, %(description)s, %(category_id)s, %(category_name)s, %(cost_points)s, %(status)s, %(color)s, now())
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  cost_points = excluded.cost_points,
  status = excluded.status,
  color = excluded.color,
  updated_at = now();

insert into missions (id, title, description, target, reward_points, action_label, event_type, filter_waste_type_id, status, updated_at)
values (%(id)s, %(title)s, %(description)s, %(target)s, %(reward_points)s, %(action_label)s, %(event_type)s, %(filter_waste_type_id)s, %(status)s, now())
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  target = excluded.target,
  reward_points = excluded.reward_points,
  action_label = excluded.action_label,
  event_type = excluded.event_type,
  filter_waste_type_id = excluded.filter_waste_type_id,
  status = excluded.status,
  updated_at = now();

insert into settings (id, threshold, model_name, class_count, updated_at)
values (%(id)s, %(threshold)s, %(model_name)s, %(class_count)s, now())
on conflict (id) do update set
  threshold = excluded.threshold,
  model_name = excluded.model_name,
  class_count = excluded.class_count,
  updated_at = now();
"""


def _ts(hours_ago=0, minutes_ago=0, minutes_ahead=0):
    return datetime.now(timezone.utc) - timedelta(hours=hours_ago, minutes=minutes_ago) + timedelta(minutes=minutes_ahead)


def _password_hash():
    return app.hash_password(TEMPORARY_PASSWORD)


def build_demo_dataset():
    avatar_presets = [
        {"key": "UTEHY_AVATAR_GREEN", "label": "Sinh viên xanh", "image_url": "/uploads/avatars/utehy-avatar-green.svg"},
        {"key": "UTEHY_AVATAR_TECH", "label": "Kỹ thuật trẻ", "image_url": "/uploads/avatars/utehy-avatar-tech.svg"},
        {"key": "UTEHY_AVATAR_VOLUNTEER", "label": "Tình nguyện viên", "image_url": "/uploads/avatars/utehy-avatar-volunteer.svg"},
        {"key": "UTEHY_AVATAR_RESEARCH", "label": "Nhà nghiên cứu", "image_url": "/uploads/avatars/utehy-avatar-research.svg"},
        {"key": "UTEHY_AVATAR_RECYCLE", "label": "Người tái chế", "image_url": "/uploads/avatars/utehy-avatar-recycle.svg"},
        {"key": "UTEHY_AVATAR_CAMPUS", "label": "UTEHY Campus", "image_url": "/uploads/avatars/utehy-avatar-campus.svg"},
    ]

    avatar_urls = {item["key"]: item["image_url"] for item in avatar_presets}
    users = [
        {"id": "UTEHY_ADMIN_01", "name": "Quản trị viên UTEHY", "email": "admin@utehy.edu.vn", "role": "admin", "group": "Phòng CTSV", "points": 0, "status": "active", "avatar_key": "UTEHY_AVATAR_CAMPUS"},
        {"id": "UTEHY_TEACHER_01", "name": "TS. Nguyễn Minh Khoa", "email": "khoa.nguyen@utehy.edu.vn", "role": "teacher", "group": "Khoa Công nghệ thông tin", "points": 0, "status": "active", "avatar_key": "UTEHY_AVATAR_RESEARCH"},
        {"id": "UTEHY_VOL_01", "name": "Trần Hải Nam", "email": "nam.tranhai@utehy.edu.vn", "role": "volunteer", "group": "Đội xanh UTEHY", "points": 280, "status": "active", "avatar_key": "UTEHY_AVATAR_VOLUNTEER"},
        {"id": "UTEHY_VOL_02", "name": "Phạm Thu Hà", "email": "ha.phamthu@utehy.edu.vn", "role": "volunteer", "group": "Đội xanh UTEHY", "points": 210, "status": "active", "avatar_key": "UTEHY_AVATAR_VOLUNTEER"},
        {"id": "UTEHY_VOL_03", "name": "Lê Đức Minh", "email": "minh.leduc@utehy.edu.vn", "role": "volunteer", "group": "CLB Môi trường", "points": 120, "status": "pending", "avatar_key": "UTEHY_AVATAR_TECH"},
        {"id": "UTEHY_STU_10123001", "name": "Nguyễn Văn An", "email": "10123001@utehy.edu.vn", "role": "student", "group": "12523W.4", "points": 420, "status": "active", "avatar_key": "UTEHY_AVATAR_GREEN"},
        {"id": "UTEHY_STU_10123024", "name": "Nguyễn Thị Minh Anh", "email": "10123024@utehy.edu.vn", "role": "student", "group": "12523W.4", "points": 360, "status": "active", "avatar_key": "UTEHY_AVATAR_RECYCLE"},
        {"id": "UTEHY_STU_12523003", "name": "Phạm Huy Anh", "email": "12523003@utehy.edu.vn", "role": "student", "group": "12523W.4", "points": 310, "status": "active", "avatar_key": "UTEHY_AVATAR_TECH"},
        {"id": "UTEHY_STU_10123028", "name": "Đỗ Quốc Ánh", "email": "10123028@utehy.edu.vn", "role": "student", "group": "12523W.4", "points": 260, "status": "active", "avatar_key": "UTEHY_AVATAR_GREEN"},
        {"id": "UTEHY_STU_12523006", "name": "Trương Quân Bảo", "email": "12523006@utehy.edu.vn", "role": "student", "group": "12523W.4", "points": 190, "status": "active", "avatar_key": "UTEHY_AVATAR_CAMPUS"},
        {"id": "UTEHY_STU_10123053", "name": "Bùi Trí Dũng", "email": "10123053@utehy.edu.vn", "role": "student", "group": "12523W.4", "points": 150, "status": "active", "avatar_key": "UTEHY_AVATAR_GREEN"},
        {"id": "UTEHY_STU_10123066", "name": "Nguyễn Quang Dương", "email": "10123066@utehy.edu.vn", "role": "student", "group": "12523W.4", "points": 95, "status": "active", "avatar_key": "UTEHY_AVATAR_TECH"},
        {"id": "UTEHY_STU_10123196", "name": "Trần Mai Lan", "email": "10123196@utehy.edu.vn", "role": "student", "group": "12523W.4", "points": 70, "status": "active", "avatar_key": "UTEHY_AVATAR_RECYCLE"},
        {"id": "UTEHY_STU_10123236", "name": "Đặng Thùy Nga", "email": "10123236@utehy.edu.vn", "role": "student", "group": "12523W.4", "points": 45, "status": "active", "avatar_key": "UTEHY_AVATAR_CAMPUS"},
        {"id": "UTEHY_STU_12523088", "name": "Đinh Xuân Trường", "email": "12523088@utehy.edu.vn", "role": "student", "group": "12523W.4", "points": 20, "status": "locked", "avatar_key": "UTEHY_AVATAR_TECH"},
        {"id": "UTEHY_STU_10124501", "name": "Vũ Hoài Linh", "email": "10124501@utehy.edu.vn", "role": "student", "group": "12524W.2", "points": 135, "status": "active", "avatar_key": "UTEHY_AVATAR_GREEN"},
        {"id": "UTEHY_STU_10124518", "name": "Hoàng Minh Châu", "email": "10124518@utehy.edu.vn", "role": "student", "group": "12524W.2", "points": 88, "status": "active", "avatar_key": "UTEHY_AVATAR_RECYCLE"},
        {"id": "UTEHY_STU_10122509", "name": "Đào Gia Hưng", "email": "10122509@utehy.edu.vn", "role": "student", "group": "12522W.1", "points": 240, "status": "active", "avatar_key": "UTEHY_AVATAR_TECH"},
    ]
    faculty_profiles = [
        ("information-technology", "Khoa Công nghệ thông tin"),
        ("mechanical-engineering", "Khoa Cơ khí"),
        ("electrical-electronics", "Khoa Điện – Điện tử"),
        ("chemical-environmental", "Khoa Công nghệ Hóa học và Môi trường"),
        ("economics", "Khoa Kinh tế"),
    ]
    profile_index = 0
    for user in users:
        if user["role"] in {"student", "volunteer"}:
            faculty_code, faculty_name = faculty_profiles[profile_index % len(faculty_profiles)]
            user["student_code"] = (
                user["email"].split("@", 1)[0].upper()
                if user["role"] == "student"
                else f"HYUTEVOL{profile_index + 1:02d}"
            )
            user["faculty_code"] = faculty_code
            user["phone_number"] = f"09010000{profile_index + 1:02d}"
            user["group"] = faculty_name
            profile_index += 1
        else:
            user["student_code"] = None
            user["faculty_code"] = None
            user["phone_number"] = None
        user["password_hash"] = _password_hash()
        user["avatar_url"] = avatar_urls.get(user["avatar_key"])

    bins = [
        {"id": "UTEHY_BIN_GATE_A", "name": "Cổng chính UTEHY", "bin_group": "Nhựa", "location": "Cổng chính, mặt đường Nguyễn Văn Linh", "building": "Cổng trường", "floor": "Ngoài trời", "qr_code": "ECL-ST-UTEHY-GATE-A", "status": "active", "capacity": 42, "latitude": 20.9517, "longitude": 106.0544, "map_x": 15, "map_y": 78},
        {"id": "UTEHY_BIN_A1", "name": "Sảnh nhà A1", "bin_group": "Giấy", "location": "Khu giảng đường A1", "building": "A1", "floor": "Tầng 1", "qr_code": "ECL-ST-UTEHY-A1", "status": "active", "capacity": 58, "latitude": 20.9519, "longitude": 106.0549, "map_x": 30, "map_y": 48},
        {"id": "UTEHY_BIN_A2", "name": "Hành lang nhà A2", "bin_group": "Lon kim loại", "location": "Khu giảng đường A2", "building": "A2", "floor": "Tầng 1", "qr_code": "ECL-ST-UTEHY-A2", "status": "full", "capacity": 92, "latitude": 20.9522, "longitude": 106.0551, "map_x": 38, "map_y": 42},
        {"id": "UTEHY_BIN_B1", "name": "Xưởng thực hành B1", "bin_group": "Điện tử", "location": "Khu xưởng thực hành", "building": "B1", "floor": "Tầng 1", "qr_code": "ECL-ST-UTEHY-B1", "status": "active", "capacity": 34, "latitude": 20.9525, "longitude": 106.0546, "map_x": 52, "map_y": 55},
        {"id": "UTEHY_BIN_LIBRARY", "name": "Thư viện trung tâm", "bin_group": "Giấy", "location": "Sảnh thư viện", "building": "Thư viện", "floor": "Tầng 1", "qr_code": "ECL-ST-UTEHY-LIBRARY", "status": "active", "capacity": 24, "latitude": 20.9521, "longitude": 106.0557, "map_x": 64, "map_y": 36},
        {"id": "UTEHY_BIN_CANTEEN", "name": "Căng tin sinh viên", "bin_group": "Hữu cơ", "location": "Khu căng tin", "building": "Căng tin", "floor": "Tầng 1", "qr_code": "ECL-ST-UTEHY-CANTEEN", "status": "active", "capacity": 67, "latitude": 20.9515, "longitude": 106.0555, "map_x": 70, "map_y": 70},
        {"id": "UTEHY_BIN_DORM", "name": "Ký túc xá khu C", "bin_group": "Nhựa", "location": "Lối vào ký túc xá", "building": "KTX C", "floor": "Ngoài trời", "qr_code": "ECL-ST-UTEHY-DORM-C", "status": "maintenance", "capacity": 15, "latitude": 20.953, "longitude": 106.0559, "map_x": 82, "map_y": 54},
        {"id": "UTEHY_BIN_SPORT", "name": "Sân thể chất", "bin_group": "Chai nhựa", "location": "Nhà thi đấu và sân bóng", "building": "Khu thể chất", "floor": "Ngoài trời", "qr_code": "ECL-ST-UTEHY-SPORT", "status": "active", "capacity": 49, "latitude": 20.9509, "longitude": 106.0548, "map_x": 45, "map_y": 86},
    ]

    waste_types = [
        {"id": "UTEHY_WASTE_PLASTIC_BOTTLE", "name": "Chai nhựa PET", "unit": "chai", "point_per_unit": 8, "recycle_method": "Làm sạch, ép dẹp và chuyển về điểm tập kết nhựa.", "status": "active"},
        {"id": "UTEHY_WASTE_PAPER", "name": "Giấy văn phòng", "unit": "kg", "point_per_unit": 12, "recycle_method": "Buộc gọn, giữ khô, chuyển tới đơn vị tái chế giấy.", "status": "active"},
        {"id": "UTEHY_WASTE_CAN", "name": "Lon nhôm", "unit": "lon", "point_per_unit": 10, "recycle_method": "Rửa sạch, ép dẹp và gom theo túi kim loại.", "status": "active"},
        {"id": "UTEHY_WASTE_CARDBOARD", "name": "Bìa carton", "unit": "kg", "point_per_unit": 9, "recycle_method": "Tháo băng dính, gấp phẳng và giữ khô.", "status": "active"},
        {"id": "UTEHY_WASTE_GLASS", "name": "Chai thủy tinh", "unit": "chai", "point_per_unit": 7, "recycle_method": "Bọc an toàn, phân loại riêng để tránh vỡ.", "status": "active"},
        {"id": "UTEHY_WASTE_ORGANIC", "name": "Rác hữu cơ căng tin", "unit": "kg", "point_per_unit": 4, "recycle_method": "Tách khỏi nhựa, chuyển về khu ủ phân hữu cơ.", "status": "active"},
        {"id": "UTEHY_WASTE_EWASTE", "name": "Pin và linh kiện nhỏ", "unit": "món", "point_per_unit": 18, "recycle_method": "Đóng hộp kín, bàn giao theo đợt thu gom rác thải nguy hại.", "status": "active"},
    ]

    point_rules = [
        {"id": "UTEHY_RULE_PLASTIC", "label": "Nhựa sạch", "class_keys": ["plastic", "chai nhựa", "PET"], "bin_group": "Nhựa", "points": 8, "enabled": True},
        {"id": "UTEHY_RULE_PAPER", "label": "Giấy khô", "class_keys": ["paper", "giấy", "carton"], "bin_group": "Giấy", "points": 12, "enabled": True},
        {"id": "UTEHY_RULE_CAN", "label": "Lon kim loại", "class_keys": ["can", "lon nhôm", "metal"], "bin_group": "Lon kim loại", "points": 10, "enabled": True},
        {"id": "UTEHY_RULE_GLASS", "label": "Thủy tinh", "class_keys": ["glass", "chai thủy tinh"], "bin_group": "Thủy tinh", "points": 7, "enabled": True},
        {"id": "UTEHY_RULE_ORGANIC", "label": "Hữu cơ", "class_keys": ["organic", "hữu cơ", "food"], "bin_group": "Hữu cơ", "points": 4, "enabled": True},
        {"id": "UTEHY_RULE_EWASTE", "label": "Rác điện tử nhỏ", "class_keys": ["battery", "pin", "e-waste"], "bin_group": "Điện tử", "points": 18, "enabled": True},
    ]

    reward_categories = [
        {"id": "UTEHY_REWARD_CAT_FOOD", "name": "Ăn uống", "description": "Voucher căng tin, đồ uống và bữa ăn nhẹ trong khuôn viên.", "status": "active", "color": "#16A34A"},
        {"id": "UTEHY_REWARD_CAT_STUDY", "name": "Học tập", "description": "Sổ tay, nhà sách, văn phòng phẩm và tài liệu học tập.", "status": "active", "color": "#2563EB"},
        {"id": "UTEHY_REWARD_CAT_TRANSPORT", "name": "Di chuyển", "description": "Ưu đãi gửi xe và hỗ trợ đi lại trong trường.", "status": "active", "color": "#D97706"},
        {"id": "UTEHY_REWARD_CAT_GREEN", "name": "Đồ dùng xanh", "description": "Vật dụng tái sử dụng giúp giảm rác thải nhựa.", "status": "active", "color": "#0F766E"},
        {"id": "UTEHY_REWARD_CAT_BADGE", "name": "Ghi nhận", "description": "Huy hiệu, giấy chứng nhận và phần thưởng phong trào.", "status": "active", "color": "#7C3AED"},
    ]

    rewards = [
        {"id": "UTEHY_REWARD_CANTEEN_20K", "title": "Voucher căng tin 20.000đ", "description": "Áp dụng tại căng tin sinh viên UTEHY.", "category_id": "UTEHY_REWARD_CAT_FOOD", "category_name": "Ăn uống", "cost_points": 160, "status": "active", "color": "#2F8F5B"},
        {"id": "UTEHY_REWARD_PARKING", "title": "Vé gửi xe 1 tuần", "description": "Đổi phiếu hỗ trợ gửi xe trong khuôn viên.", "category_id": "UTEHY_REWARD_CAT_TRANSPORT", "category_name": "Di chuyển", "cost_points": 220, "status": "active", "color": "#1D4ED8"},
        {"id": "UTEHY_REWARD_NOTEBOOK", "title": "Sổ tay Eco-loop", "description": "Sổ tay giấy tái chế dùng cho học tập.", "category_id": "UTEHY_REWARD_CAT_STUDY", "category_name": "Học tập", "cost_points": 90, "status": "active", "color": "#8B5CF6"},
        {"id": "UTEHY_REWARD_BOTTLE", "title": "Bình nước UTEHY", "description": "Bình nước cá nhân giảm chai nhựa dùng một lần.", "category_id": "UTEHY_REWARD_CAT_GREEN", "category_name": "Đồ dùng xanh", "cost_points": 380, "status": "active", "color": "#0F766E"},
        {"id": "UTEHY_REWARD_BADGE", "title": "Huy hiệu Sinh viên xanh", "description": "Huy hiệu ghi nhận hoạt động phân loại rác.", "category_id": "UTEHY_REWARD_CAT_BADGE", "category_name": "Ghi nhận", "cost_points": 60, "status": "active", "color": "#D97706"},
        {"id": "UTEHY_REWARD_BOOKSTORE", "title": "Phiếu nhà sách 30.000đ", "description": "Đổi tại quầy sách và văn phòng phẩm trong trường.", "category_id": "UTEHY_REWARD_CAT_STUDY", "category_name": "Học tập", "cost_points": 250, "status": "inactive", "color": "#BE123C"},
    ]

    missions = [
        {"id": "UTEHY_MISSION_WEEKLY_5", "title": "Tuần xanh 5 lượt", "description": "Hoàn thành 5 lượt tái chế hợp lệ trong tuần.", "target": 5, "reward_points": 40, "action_label": "Quét QR", "event_type": "submission_confirmed", "filter_waste_type_id": None, "status": "active"},
        {"id": "UTEHY_MISSION_PLASTIC_10", "title": "Gom 10 chai nhựa", "description": "Tái chế 10 chai nhựa PET tại các trạm trong trường.", "target": 10, "reward_points": 35, "action_label": "Nộp chai", "event_type": "submission_confirmed", "filter_waste_type_id": "UTEHY_WASTE_PLASTIC_BOTTLE", "status": "active"},
        {"id": "UTEHY_MISSION_FEEDBACK", "title": "Góp ý trạm rác", "description": "Gửi 1 phản hồi có ích về tình trạng trạm thu gom.", "target": 1, "reward_points": 15, "action_label": "Gửi phản hồi", "event_type": "feedback_created", "filter_waste_type_id": None, "status": "active"},
        {"id": "UTEHY_MISSION_PAPER_3KG", "title": "Giấy sạch 3kg", "description": "Thu gom 3kg giấy khô từ lớp học hoặc văn phòng.", "target": 3, "reward_points": 45, "action_label": "Ghi nhận", "event_type": "submission_confirmed", "filter_waste_type_id": "UTEHY_WASTE_PAPER", "status": "active"},
        {"id": "UTEHY_MISSION_AI_CHECK", "title": "Kiểm tra AI phân loại", "description": "Dùng chức năng AI để kiểm tra 3 ảnh rác tái chế.", "target": 3, "reward_points": 20, "action_label": "Kiểm tra AI", "event_type": "prediction_created", "filter_waste_type_id": None, "status": "active"},
    ]

    predictions = [
        {"id": "UTEHY_PRED_001", "class": "Chai nhựa PET", "confidence": 0.94, "source": "mobile", "timestamp": _ts(hours_ago=30), "bin_group": "Nhựa", "status": "approved", "user_id": "UTEHY_STU_10123001", "bin_id": "UTEHY_BIN_GATE_A", "image_name": "utehy-pred-plastic-001.svg", "image_url": "/uploads/predictions/utehy-pred-plastic-001.svg", "thumbnail_url": "/uploads/predictions/utehy-pred-plastic-001.svg"},
        {"id": "UTEHY_PRED_002", "class": "Giấy văn phòng", "confidence": 0.89, "source": "upload", "timestamp": _ts(hours_ago=26), "bin_group": "Giấy", "status": "approved", "user_id": "UTEHY_STU_10123024", "bin_id": "UTEHY_BIN_A1", "image_name": "utehy-pred-paper-002.svg", "image_url": "/uploads/predictions/utehy-pred-paper-002.svg", "thumbnail_url": "/uploads/predictions/utehy-pred-paper-002.svg"},
        {"id": "UTEHY_PRED_003", "class": "Lon nhôm", "confidence": 0.87, "source": "camera", "timestamp": _ts(hours_ago=22), "bin_group": "Lon kim loại", "status": "pending", "user_id": "UTEHY_STU_12523003", "bin_id": "UTEHY_BIN_A2", "image_name": "utehy-pred-can-003.svg", "image_url": "/uploads/predictions/utehy-pred-can-003.svg", "thumbnail_url": "/uploads/predictions/utehy-pred-can-003.svg"},
        {"id": "UTEHY_PRED_004", "class": "Pin tiểu", "confidence": 0.82, "source": "mobile", "timestamp": _ts(hours_ago=18), "bin_group": "Điện tử", "status": "approved", "user_id": "UTEHY_STU_10123028", "bin_id": "UTEHY_BIN_B1", "image_name": "utehy-pred-battery-004.svg", "image_url": "/uploads/predictions/utehy-pred-battery-004.svg", "thumbnail_url": "/uploads/predictions/utehy-pred-battery-004.svg"},
        {"id": "UTEHY_PRED_005", "class": "Hộp xốp bẩn", "confidence": 0.71, "source": "upload", "timestamp": _ts(hours_ago=14), "bin_group": "Không tái chế", "status": "rejected", "user_id": "UTEHY_STU_12523006", "bin_id": "UTEHY_BIN_CANTEEN", "image_name": "utehy-pred-dirty-box-005.svg", "image_url": "/uploads/predictions/utehy-pred-dirty-box-005.svg", "thumbnail_url": "/uploads/predictions/utehy-pred-dirty-box-005.svg"},
        {"id": "UTEHY_PRED_006", "class": "Bìa carton", "confidence": 0.91, "source": "mobile", "timestamp": _ts(hours_ago=10), "bin_group": "Giấy", "status": "approved", "user_id": "UTEHY_STU_10123053", "bin_id": "UTEHY_BIN_LIBRARY", "image_name": "utehy-pred-cardboard-006.svg", "image_url": "/uploads/predictions/utehy-pred-cardboard-006.svg", "thumbnail_url": "/uploads/predictions/utehy-pred-cardboard-006.svg"},
        {"id": "UTEHY_PRED_007", "class": "Rác hữu cơ", "confidence": 0.78, "source": "camera", "timestamp": _ts(hours_ago=6), "bin_group": "Hữu cơ", "status": "pending", "user_id": "UTEHY_STU_10123196", "bin_id": "UTEHY_BIN_CANTEEN", "image_name": "utehy-pred-organic-007.svg", "image_url": "/uploads/predictions/utehy-pred-organic-007.svg", "thumbnail_url": "/uploads/predictions/utehy-pred-organic-007.svg"},
        {"id": "UTEHY_PRED_008", "class": "Chai thủy tinh", "confidence": 0.85, "source": "mobile", "timestamp": _ts(hours_ago=3), "bin_group": "Thủy tinh", "status": "approved", "user_id": "UTEHY_STU_10123236", "bin_id": "UTEHY_BIN_GATE_A", "image_name": "utehy-pred-glass-008.svg", "image_url": "/uploads/predictions/utehy-pred-glass-008.svg", "thumbnail_url": "/uploads/predictions/utehy-pred-glass-008.svg"},
    ]

    submissions = [
        {"id": "UTEHY_SUB_001", "user_id": "UTEHY_STU_10123001", "bin_id": "UTEHY_BIN_GATE_A", "waste_type_id": "UTEHY_WASTE_PLASTIC_BOTTLE", "quantity": 6, "unit": "chai", "qr_token": "ECL-SUB-UTEHY-202609010801-001", "qr_signature": "UTEHY_SIG_001", "status": "POINT_CONFIRMED", "created_at": _ts(hours_ago=28), "expired_at": _ts(hours_ago=27), "verified_by": "UTEHY_VOL_01", "verified_at": _ts(hours_ago=27, minutes_ago=40), "actual_quantity": 6, "volunteer_note": "Đã kiểm tra chai sạch."},
        {"id": "UTEHY_SUB_002", "user_id": "UTEHY_STU_10123024", "bin_id": "UTEHY_BIN_A1", "waste_type_id": "UTEHY_WASTE_PAPER", "quantity": 2, "unit": "kg", "qr_token": "ECL-SUB-UTEHY-202609010842-002", "qr_signature": "UTEHY_SIG_002", "status": "QR_SCANNED", "created_at": _ts(hours_ago=24), "expired_at": _ts(hours_ago=23), "verified_by": "UTEHY_VOL_02", "verified_at": _ts(hours_ago=23, minutes_ago=50), "actual_quantity": None, "volunteer_note": "Chờ ảnh chứng minh rõ hơn."},
        {"id": "UTEHY_SUB_003", "user_id": "UTEHY_STU_12523003", "bin_id": "UTEHY_BIN_A2", "waste_type_id": "UTEHY_WASTE_CAN", "quantity": 8, "unit": "lon", "qr_token": "ECL-SUB-UTEHY-202609011015-003", "qr_signature": "UTEHY_SIG_003", "status": "REJECTED", "created_at": _ts(hours_ago=20), "expired_at": _ts(hours_ago=19), "verified_by": "UTEHY_VOL_01", "verified_at": _ts(hours_ago=19, minutes_ago=40), "actual_quantity": 0, "volunteer_note": "Sai loại rác so với khai báo."},
        {"id": "UTEHY_SUB_004", "user_id": "UTEHY_STU_10123028", "bin_id": "UTEHY_BIN_B1", "waste_type_id": "UTEHY_WASTE_EWASTE", "quantity": 3, "unit": "món", "qr_token": "ECL-SUB-UTEHY-202609011140-004", "qr_signature": "UTEHY_SIG_004", "status": "PENDING_REVIEW", "created_at": _ts(hours_ago=16), "expired_at": _ts(hours_ago=15), "verified_by": "UTEHY_VOL_02", "verified_at": _ts(hours_ago=15, minutes_ago=45), "actual_quantity": None, "volunteer_note": "Cần admin xem lại pin phồng."},
        {"id": "UTEHY_SUB_005", "user_id": "UTEHY_STU_12523006", "bin_id": "UTEHY_BIN_CANTEEN", "waste_type_id": "UTEHY_WASTE_ORGANIC", "quantity": 1.5, "unit": "kg", "qr_token": "ECL-SUB-UTEHY-202609011305-005", "qr_signature": "UTEHY_SIG_005", "status": "EXPIRED", "created_at": _ts(hours_ago=12), "expired_at": _ts(hours_ago=11), "verified_by": None, "verified_at": None, "actual_quantity": None, "volunteer_note": ""},
        {"id": "UTEHY_SUB_006", "user_id": "UTEHY_STU_10123053", "bin_id": "UTEHY_BIN_LIBRARY", "waste_type_id": "UTEHY_WASTE_CARDBOARD", "quantity": 1.2, "unit": "kg", "qr_token": "ECL-SUB-UTEHY-202609011520-006", "qr_signature": "UTEHY_SIG_006", "status": "POINT_CONFIRMED", "created_at": _ts(hours_ago=8), "expired_at": _ts(hours_ago=7), "verified_by": "UTEHY_VOL_01", "verified_at": _ts(hours_ago=7, minutes_ago=35), "actual_quantity": 1.2, "volunteer_note": "Carton khô, đủ điều kiện."},
        {"id": "UTEHY_SUB_007", "user_id": "UTEHY_STU_10123196", "bin_id": "UTEHY_BIN_CANTEEN", "waste_type_id": "UTEHY_WASTE_ORGANIC", "quantity": 2, "unit": "kg", "qr_token": "ECL-SUB-UTEHY-202609011702-007", "qr_signature": "UTEHY_SIG_007", "status": "CREATED", "created_at": _ts(minutes_ago=20), "expired_at": _ts(minutes_ahead=25), "verified_by": None, "verified_at": None, "actual_quantity": None, "volunteer_note": ""},
        {"id": "UTEHY_SUB_008", "user_id": "UTEHY_STU_10123236", "bin_id": "UTEHY_BIN_GATE_A", "waste_type_id": "UTEHY_WASTE_GLASS", "quantity": 4, "unit": "chai", "qr_token": "ECL-SUB-UTEHY-202609011718-008", "qr_signature": "UTEHY_SIG_008", "status": "POINT_CONFIRMED", "created_at": _ts(hours_ago=2), "expired_at": _ts(hours_ago=1), "verified_by": "UTEHY_VOL_02", "verified_at": _ts(hours_ago=1, minutes_ago=40), "actual_quantity": 4, "volunteer_note": "Đã bọc riêng chai thủy tinh."},
    ]

    qr_scan_logs = [
        {"id": "UTEHY_QRLOG_001", "qr_token": "ECL-SUB-UTEHY-202609010801-001", "scanned_by": "UTEHY_VOL_01", "station_id": "UTEHY_BIN_GATE_A", "scanned_at": _ts(hours_ago=27, minutes_ago=42), "result": "SUCCESS", "note": "Quét đúng trạm cổng chính."},
        {"id": "UTEHY_QRLOG_002", "qr_token": "ECL-SUB-UTEHY-202609010842-002", "scanned_by": "UTEHY_VOL_02", "station_id": "UTEHY_BIN_A1", "scanned_at": _ts(hours_ago=23, minutes_ago=51), "result": "SUCCESS", "note": "Đang chờ xác nhận."},
        {"id": "UTEHY_QRLOG_003", "qr_token": "ECL-SUB-UTEHY-202609011015-003", "scanned_by": "UTEHY_VOL_01", "station_id": "UTEHY_BIN_A2", "scanned_at": _ts(hours_ago=19, minutes_ago=42), "result": "SUCCESS", "note": ""},
        {"id": "UTEHY_QRLOG_004", "qr_token": "ECL-SUB-UTEHY-202609011140-004", "scanned_by": "UTEHY_VOL_02", "station_id": "UTEHY_BIN_B1", "scanned_at": _ts(hours_ago=15, minutes_ago=47), "result": "SUCCESS", "note": "Chuyển review."},
        {"id": "UTEHY_QRLOG_005", "qr_token": "ECL-SUB-UTEHY-202609011305-005", "scanned_by": "UTEHY_VOL_01", "station_id": "UTEHY_BIN_CANTEEN", "scanned_at": _ts(hours_ago=10), "result": "EXPIRED", "note": "QR quá hạn."},
        {"id": "UTEHY_QRLOG_006", "qr_token": "ECL-SUB-UTEHY-202609011520-006", "scanned_by": "UTEHY_VOL_01", "station_id": "UTEHY_BIN_LIBRARY", "scanned_at": _ts(hours_ago=7, minutes_ago=37), "result": "SUCCESS", "note": ""},
        {"id": "UTEHY_QRLOG_007", "qr_token": "ECL-SUB-UTEHY-202609011520-006", "scanned_by": "UTEHY_VOL_02", "station_id": "UTEHY_BIN_A1", "scanned_at": _ts(hours_ago=7, minutes_ago=20), "result": "ALREADY_USED", "note": "Thử quét lại sau xác nhận."},
        {"id": "UTEHY_QRLOG_008", "qr_token": "ECL-SUB-UTEHY-202609011718-008", "scanned_by": "UTEHY_VOL_02", "station_id": "UTEHY_BIN_A1", "scanned_at": _ts(hours_ago=1, minutes_ago=45), "result": "WRONG_STATION", "note": "Quét nhầm trạm."},
        {"id": "UTEHY_QRLOG_009", "qr_token": "ECL-SUB-UTEHY-202609011718-008", "scanned_by": "UTEHY_VOL_02", "station_id": "UTEHY_BIN_GATE_A", "scanned_at": _ts(hours_ago=1, minutes_ago=42), "result": "SUCCESS", "note": "Quét lại đúng trạm."},
        {"id": "UTEHY_QRLOG_010", "qr_token": "ECL-SUB-UTEHY-INVALID", "scanned_by": "UTEHY_VOL_01", "station_id": "UTEHY_BIN_GATE_A", "scanned_at": _ts(minutes_ago=55), "result": "INVALID_TOKEN", "note": "Mã không thuộc hệ thống."},
    ]

    proof_images = [
        {"id": "UTEHY_PROOF_001", "submission_id": "UTEHY_SUB_001", "image_url": "/uploads/proofs/utehy-proof-001.svg", "image_hash": "utehy-proof-hash-001", "captured_at": _ts(hours_ago=27, minutes_ago=39), "verification_code": "UTEHY-001", "status": "accepted", "note": "Chai nhựa rõ số lượng."},
        {"id": "UTEHY_PROOF_002", "submission_id": "UTEHY_SUB_002", "image_url": "/uploads/proofs/utehy-proof-002.svg", "image_hash": "utehy-proof-hash-002", "captured_at": _ts(hours_ago=23, minutes_ago=48), "verification_code": "UTEHY-002", "status": "pending", "note": "Ảnh giấy hơi mờ."},
        {"id": "UTEHY_PROOF_003", "submission_id": "UTEHY_SUB_003", "image_url": "/uploads/proofs/utehy-proof-003.svg", "image_hash": "utehy-proof-hash-003", "captured_at": _ts(hours_ago=19, minutes_ago=38), "verification_code": "UTEHY-003", "status": "rejected", "note": "Không đúng loại lon."},
        {"id": "UTEHY_PROOF_004", "submission_id": "UTEHY_SUB_004", "image_url": "/uploads/proofs/utehy-proof-004.svg", "image_hash": "utehy-proof-hash-004", "captured_at": _ts(hours_ago=15, minutes_ago=44), "verification_code": "UTEHY-004", "status": "pending", "note": "Pin cần kiểm tra an toàn."},
        {"id": "UTEHY_PROOF_005", "submission_id": "UTEHY_SUB_006", "image_url": "/uploads/proofs/utehy-proof-005.svg", "image_hash": "utehy-proof-hash-005", "captured_at": _ts(hours_ago=7, minutes_ago=33), "verification_code": "UTEHY-005", "status": "accepted", "note": "Carton khô."},
        {"id": "UTEHY_PROOF_006", "submission_id": "UTEHY_SUB_008", "image_url": "/uploads/proofs/utehy-proof-006.svg", "image_hash": "utehy-proof-hash-006", "captured_at": _ts(hours_ago=1, minutes_ago=39), "verification_code": "UTEHY-006", "status": "accepted", "note": "Thủy tinh đã bọc riêng."},
    ]

    point_history = [
        {"prediction_id": "UTEHY_PRED_001", "submission_id": "UTEHY_SUB_001", "user_id": "UTEHY_STU_10123001", "bin_id": "UTEHY_BIN_GATE_A", "class": "Chai nhựa PET", "bin_group": "Nhựa", "action": "Xác nhận QR tái chế", "points": 48, "timestamp": _ts(hours_ago=27, minutes_ago=38), "admin_note": "Seed demo UTEHY", "source": "utehy_demo_seed", "description": "Cộng điểm 6 chai nhựa tại cổng chính.", "status": "confirmed"},
        {"prediction_id": "UTEHY_PRED_002", "submission_id": None, "user_id": "UTEHY_STU_10123024", "bin_id": "UTEHY_BIN_A1", "class": "Giấy văn phòng", "bin_group": "Giấy", "action": "Duyệt dự đoán AI", "points": 24, "timestamp": _ts(hours_ago=25), "admin_note": "Seed demo UTEHY", "source": "utehy_demo_seed", "description": "AI nhận diện giấy khô.", "status": "confirmed"},
        {"prediction_id": "UTEHY_PRED_004", "submission_id": None, "user_id": "UTEHY_STU_10123028", "bin_id": "UTEHY_BIN_B1", "class": "Pin tiểu", "bin_group": "Điện tử", "action": "Ghi nhận rác điện tử", "points": 54, "timestamp": _ts(hours_ago=17), "admin_note": "Seed demo UTEHY", "source": "utehy_demo_seed", "description": "Gom pin cũ đúng trạm B1.", "status": "confirmed"},
        {"prediction_id": None, "submission_id": "UTEHY_SUB_006", "user_id": "UTEHY_STU_10123053", "bin_id": "UTEHY_BIN_LIBRARY", "class": "Bìa carton", "bin_group": "Giấy", "action": "Xác nhận QR tái chế", "points": 11, "timestamp": _ts(hours_ago=7, minutes_ago=32), "admin_note": "Seed demo UTEHY", "source": "utehy_demo_seed", "description": "Cộng điểm bìa carton thư viện.", "status": "confirmed"},
        {"prediction_id": None, "submission_id": "UTEHY_SUB_008", "user_id": "UTEHY_STU_10123236", "bin_id": "UTEHY_BIN_GATE_A", "class": "Chai thủy tinh", "bin_group": "Thủy tinh", "action": "Xác nhận QR tái chế", "points": 28, "timestamp": _ts(hours_ago=1, minutes_ago=35), "admin_note": "Seed demo UTEHY", "source": "utehy_demo_seed", "description": "Cộng điểm chai thủy tinh.", "status": "confirmed"},
        {"prediction_id": None, "submission_id": None, "user_id": "UTEHY_STU_12523003", "bin_id": "UTEHY_BIN_A2", "class": "Lon nhôm", "bin_group": "Lon kim loại", "action": "Điều chỉnh sau kiểm tra", "points": -10, "timestamp": _ts(hours_ago=18), "admin_note": "Sai phân loại trong một lượt test.", "source": "utehy_demo_seed", "description": "Trừ điểm giao dịch bị từ chối.", "status": "confirmed"},
        {"prediction_id": None, "submission_id": None, "user_id": "UTEHY_VOL_01", "bin_id": "UTEHY_BIN_LIBRARY", "class": "Ca trực", "bin_group": "Tình nguyện", "action": "Hoàn thành ca trực xanh", "points": 30, "timestamp": _ts(hours_ago=6), "admin_note": "Seed demo UTEHY", "source": "utehy_demo_seed", "description": "Thưởng tình nguyện viên trực trạm.", "status": "confirmed"},
        {"prediction_id": None, "submission_id": None, "user_id": "UTEHY_STU_10123001", "bin_id": "UTEHY_BIN_GATE_A", "class": "Nhiệm vụ tuần", "bin_group": "Nhiệm vụ", "action": "Hoàn thành nhiệm vụ", "points": 40, "timestamp": _ts(hours_ago=4), "admin_note": "Seed demo UTEHY", "source": "utehy_demo_seed", "description": "Hoàn thành Tuần xanh 5 lượt.", "status": "confirmed"},
    ]

    reward_redemptions = [
        {"id": "UTEHY_REDEEM_001", "user_id": "UTEHY_STU_10123001", "reward_id": "UTEHY_REWARD_NOTEBOOK", "reward_label": "Sổ tay Eco-loop", "cost_points": 90, "status": "approved", "requested_at": _ts(hours_ago=32), "reviewed_at": _ts(hours_ago=31), "admin_note": "Đã phát tại văn phòng Đoàn."},
        {"id": "UTEHY_REDEEM_002", "user_id": "UTEHY_STU_10123024", "reward_id": "UTEHY_REWARD_CANTEEN_20K", "reward_label": "Voucher căng tin 20.000đ", "cost_points": 160, "status": "pending", "requested_at": _ts(hours_ago=9), "reviewed_at": None, "admin_note": ""},
        {"id": "UTEHY_REDEEM_003", "user_id": "UTEHY_STU_12523003", "reward_id": "UTEHY_REWARD_BADGE", "reward_label": "Huy hiệu Sinh viên xanh", "cost_points": 60, "status": "rejected", "requested_at": _ts(hours_ago=15), "reviewed_at": _ts(hours_ago=14), "admin_note": "Tài khoản đang chờ đối soát lượt quét."},
        {"id": "UTEHY_REDEEM_004", "user_id": "UTEHY_STU_10122509", "reward_id": "UTEHY_REWARD_PARKING", "reward_label": "Vé gửi xe 1 tuần", "cost_points": 220, "status": "approved", "requested_at": _ts(hours_ago=50), "reviewed_at": _ts(hours_ago=48), "admin_note": "Đã gửi mã đổi thưởng."},
    ]

    feedback = [
        {"id": "UTEHY_FEEDBACK_001", "user_id": "UTEHY_STU_10123001", "user_name": "Nguyễn Văn An", "category": "Trạm thu gom", "message": "Thùng nhựa ở cổng chính đầy nhanh vào giờ tan học.", "status": "in_progress", "priority": "high", "bin_id": "UTEHY_BIN_GATE_A", "admin_note": "Đã nhắc đội thu gom tăng lượt kiểm tra.", "resolved_at": None, "timestamp": _ts(hours_ago=11), "created_at": _ts(hours_ago=11)},
        {"id": "UTEHY_FEEDBACK_002", "user_id": "UTEHY_STU_10123024", "user_name": "Nguyễn Thị Minh Anh", "category": "Ứng dụng", "message": "Ảnh AI nên hiện hướng dẫn chụp rõ hơn.", "status": "unread", "priority": "medium", "bin_id": None, "admin_note": "", "resolved_at": None, "timestamp": _ts(hours_ago=7), "created_at": _ts(hours_ago=7)},
        {"id": "UTEHY_FEEDBACK_003", "user_id": "UTEHY_VOL_01", "user_name": "Trần Hải Nam", "category": "QR", "message": "Một số sinh viên đưa QR hết hạn sau giờ học.", "status": "resolved", "priority": "low", "bin_id": "UTEHY_BIN_A1", "admin_note": "Đã bổ sung cảnh báo hạn QR.", "resolved_at": _ts(hours_ago=3), "timestamp": _ts(hours_ago=20), "created_at": _ts(hours_ago=20)},
        {"id": "UTEHY_FEEDBACK_004", "user_id": "UTEHY_STU_10123196", "user_name": "Trần Mai Lan", "category": "Phần thưởng", "message": "Muốn thêm voucher nước uống tại căng tin.", "status": "unread", "priority": "medium", "bin_id": None, "admin_note": "", "resolved_at": None, "timestamp": _ts(hours_ago=2), "created_at": _ts(hours_ago=2)},
        {"id": "UTEHY_FEEDBACK_005", "user_id": "UTEHY_STU_12523006", "user_name": "Trương Quân Bảo", "category": "Bản đồ", "message": "Trạm ký túc xá đang bảo trì nên cần hiển thị rõ hơn.", "status": "resolved", "priority": "high", "bin_id": "UTEHY_BIN_DORM", "admin_note": "Đã đặt trạng thái bảo trì.", "resolved_at": _ts(hours_ago=1), "timestamp": _ts(hours_ago=5), "created_at": _ts(hours_ago=5)},
    ]

    user_missions = [
        {"id": "UTEHY_UM_001", "user_id": "UTEHY_STU_10123001", "mission_id": "UTEHY_MISSION_WEEKLY_5", "current": 5, "completed": True, "status": "active", "updated_at": _ts(hours_ago=4)},
        {"id": "UTEHY_UM_002", "user_id": "UTEHY_STU_10123001", "mission_id": "UTEHY_MISSION_PLASTIC_10", "current": 6, "completed": False, "status": "active", "updated_at": _ts(hours_ago=3)},
        {"id": "UTEHY_UM_003", "user_id": "UTEHY_STU_10123024", "mission_id": "UTEHY_MISSION_PAPER_3KG", "current": 2, "completed": False, "status": "active", "updated_at": _ts(hours_ago=5)},
        {"id": "UTEHY_UM_004", "user_id": "UTEHY_STU_12523003", "mission_id": "UTEHY_MISSION_AI_CHECK", "current": 1, "completed": False, "status": "active", "updated_at": _ts(hours_ago=12)},
        {"id": "UTEHY_UM_005", "user_id": "UTEHY_STU_10123028", "mission_id": "UTEHY_MISSION_AI_CHECK", "current": 3, "completed": True, "status": "active", "updated_at": _ts(hours_ago=17)},
        {"id": "UTEHY_UM_006", "user_id": "UTEHY_STU_10123053", "mission_id": "UTEHY_MISSION_PAPER_3KG", "current": 1, "completed": False, "status": "active", "updated_at": _ts(hours_ago=7)},
        {"id": "UTEHY_UM_007", "user_id": "UTEHY_STU_10123196", "mission_id": "UTEHY_MISSION_FEEDBACK", "current": 1, "completed": True, "status": "active", "updated_at": _ts(hours_ago=2)},
        {"id": "UTEHY_UM_008", "user_id": "UTEHY_STU_10123236", "mission_id": "UTEHY_MISSION_WEEKLY_5", "current": 2, "completed": False, "status": "active", "updated_at": _ts(hours_ago=1)},
    ]

    return {
        "users": users,
        "bins": bins,
        "waste_types": waste_types,
        "avatar_presets": avatar_presets,
        "reward_categories": reward_categories,
        "rewards": rewards,
        "missions": missions,
        "point_rules": point_rules,
        "predictions": predictions,
        "recycling_submissions": submissions,
        "qr_scan_logs": qr_scan_logs,
        "proof_images": proof_images,
        "point_history": point_history,
        "reward_redemptions": reward_redemptions,
        "feedback": feedback,
        "user_missions": user_missions,
        "settings": {"id": "main", "threshold": 0.72, "model_name": "EcoLoop Waste Classifier V2 - UTEHY", "class_count": 7},
    }


def _write_svg(path, title, color):
    path.parent.mkdir(parents=True, exist_ok=True)
    escaped_title = title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="{color}"/>
  <circle cx="256" cy="190" r="82" fill="#ffffff" opacity=".92"/>
  <path d="M128 430c20-86 78-134 128-134s108 48 128 134" fill="#ffffff" opacity=".92"/>
  <text x="256" y="472" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">{escaped_title}</text>
</svg>
"""
    path.write_text(svg, encoding="utf-8")


def ensure_demo_upload_files():
    files = [
        ("uploads/avatars/utehy-avatar-green.svg", "Sinh viên xanh", "#16803C"),
        ("uploads/avatars/utehy-avatar-tech.svg", "Kỹ thuật trẻ", "#2563EB"),
        ("uploads/avatars/utehy-avatar-volunteer.svg", "Tình nguyện viên", "#D97706"),
        ("uploads/avatars/utehy-avatar-research.svg", "Nghiên cứu", "#7C3AED"),
        ("uploads/avatars/utehy-avatar-recycle.svg", "Tái chế", "#0F766E"),
        ("uploads/avatars/utehy-avatar-campus.svg", "UTEHY", "#BE123C"),
        ("uploads/predictions/utehy-pred-plastic-001.svg", "Chai nhựa", "#16A34A"),
        ("uploads/predictions/utehy-pred-paper-002.svg", "Giấy", "#64748B"),
        ("uploads/predictions/utehy-pred-can-003.svg", "Lon nhôm", "#94A3B8"),
        ("uploads/predictions/utehy-pred-battery-004.svg", "Pin", "#EA580C"),
        ("uploads/predictions/utehy-pred-dirty-box-005.svg", "Không tái chế", "#991B1B"),
        ("uploads/predictions/utehy-pred-cardboard-006.svg", "Carton", "#A16207"),
        ("uploads/predictions/utehy-pred-organic-007.svg", "Hữu cơ", "#65A30D"),
        ("uploads/predictions/utehy-pred-glass-008.svg", "Thủy tinh", "#0891B2"),
        ("uploads/proofs/utehy-proof-001.svg", "Proof 001", "#16A34A"),
        ("uploads/proofs/utehy-proof-002.svg", "Proof 002", "#2563EB"),
        ("uploads/proofs/utehy-proof-003.svg", "Proof 003", "#DC2626"),
        ("uploads/proofs/utehy-proof-004.svg", "Proof 004", "#D97706"),
        ("uploads/proofs/utehy-proof-005.svg", "Proof 005", "#0F766E"),
        ("uploads/proofs/utehy-proof-006.svg", "Proof 006", "#0891B2"),
    ]
    for relative_path, title, color in files:
        _write_svg(BACKEND_DIR / relative_path, title, color)
    return len(files)


def remove_demo_upload_files():
    removed = 0
    for folder_name in ["avatars", "predictions", "proofs"]:
        folder = UPLOADS_DIR / folder_name
        if not folder.exists():
            continue
        for path in folder.glob("utehy-*.svg"):
            if not path.is_file():
                continue
            path.unlink()
            removed += 1
    return removed


def _upsert_many(cursor, sql, records):
    for record in records:
        cursor.execute(sql, record)


def seed_database(database_url=None, dry_run=False):
    dataset = build_demo_dataset()
    if dry_run:
        return {key: (1 if key == "settings" else len(value)) for key, value in dataset.items()}

    target_database_url = database_url or app.require_database_url()
    files_written = ensure_demo_upload_files()
    with psycopg.connect(target_database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(E2E_CLEANUP_SQL)
            cursor.execute(DEMO_REFRESH_SQL)
            _upsert_many(cursor, """
                insert into avatar_presets (key, label, image_url, updated_at)
                values (%(key)s, %(label)s, %(image_url)s, now())
                on conflict (key) do update set label = excluded.label, image_url = excluded.image_url, updated_at = now()
            """, dataset["avatar_presets"])
            _upsert_many(cursor, """
                insert into users (id, name, email, password_hash, role, "group", points, status, student_code, faculty_code, phone_number, avatar_key, avatar_url, updated_at)
                values (%(id)s, %(name)s, %(email)s, %(password_hash)s, %(role)s, %(group)s, %(points)s, %(status)s, %(student_code)s, %(faculty_code)s, %(phone_number)s, %(avatar_key)s, %(avatar_url)s, now())
                on conflict (email) do update set
                  id = excluded.id,
                  name = excluded.name,
                  password_hash = excluded.password_hash,
                  role = excluded.role,
                  "group" = excluded."group",
                  points = excluded.points,
                  status = excluded.status,
                  student_code = excluded.student_code,
                  faculty_code = excluded.faculty_code,
                  phone_number = excluded.phone_number,
                  avatar_key = excluded.avatar_key,
                  avatar_url = excluded.avatar_url,
                  updated_at = now()
            """, dataset["users"])
            _upsert_many(cursor, """
                insert into bins (id, name, bin_group, location, building, floor, qr_code, status, capacity, latitude, longitude, map_x, map_y, updated_at)
                values (%(id)s, %(name)s, %(bin_group)s, %(location)s, %(building)s, %(floor)s, %(qr_code)s, %(status)s, %(capacity)s, %(latitude)s, %(longitude)s, %(map_x)s, %(map_y)s, now())
                on conflict (id) do update set
                  name = excluded.name,
                  bin_group = excluded.bin_group,
                  location = excluded.location,
                  building = excluded.building,
                  floor = excluded.floor,
                  qr_code = excluded.qr_code,
                  status = excluded.status,
                  capacity = excluded.capacity,
                  latitude = excluded.latitude,
                  longitude = excluded.longitude,
                  map_x = excluded.map_x,
                  map_y = excluded.map_y,
                  updated_at = now()
            """, dataset["bins"])
            _upsert_many(cursor, """
                insert into waste_types (id, name, unit, point_per_unit, recycle_method, status, updated_at)
                values (%(id)s, %(name)s, %(unit)s, %(point_per_unit)s, %(recycle_method)s, %(status)s, now())
                on conflict (id) do update set
                  name = excluded.name,
                  unit = excluded.unit,
                  point_per_unit = excluded.point_per_unit,
                  recycle_method = excluded.recycle_method,
                  status = excluded.status,
                  updated_at = now()
            """, dataset["waste_types"])
            _upsert_many(cursor, """
                insert into point_rules (id, label, class_keys, bin_group, points, enabled)
                values (%(id)s, %(label)s, %(class_keys)s, %(bin_group)s, %(points)s, %(enabled)s)
                on conflict (id) do update set label = excluded.label, class_keys = excluded.class_keys, bin_group = excluded.bin_group, points = excluded.points, enabled = excluded.enabled
            """, dataset["point_rules"])
            _upsert_many(cursor, """
                insert into reward_categories (id, name, description, status, color, updated_at)
                values (%(id)s, %(name)s, %(description)s, %(status)s, %(color)s, now())
                on conflict (id) do update set name = excluded.name, description = excluded.description, status = excluded.status, color = excluded.color, updated_at = now()
            """, dataset["reward_categories"])
            _upsert_many(cursor, """
                insert into rewards (id, title, description, category_id, category_name, cost_points, status, color, updated_at)
                values (%(id)s, %(title)s, %(description)s, %(category_id)s, %(category_name)s, %(cost_points)s, %(status)s, %(color)s, now())
                on conflict (id) do update set title = excluded.title, description = excluded.description, category_id = excluded.category_id, category_name = excluded.category_name, cost_points = excluded.cost_points, status = excluded.status, color = excluded.color, updated_at = now()
            """, dataset["rewards"])
            _upsert_many(cursor, """
                insert into missions (id, title, description, target, reward_points, action_label, event_type, filter_waste_type_id, status, updated_at)
                values (%(id)s, %(title)s, %(description)s, %(target)s, %(reward_points)s, %(action_label)s, %(event_type)s, %(filter_waste_type_id)s, %(status)s, now())
                on conflict (id) do update set title = excluded.title, description = excluded.description, target = excluded.target, reward_points = excluded.reward_points, action_label = excluded.action_label, event_type = excluded.event_type, filter_waste_type_id = excluded.filter_waste_type_id, status = excluded.status, updated_at = now()
            """, dataset["missions"])
            _upsert_many(cursor, """
                insert into predictions (id, class, confidence, source, timestamp, bin_group, status, user_id, bin_id, image_name, image_url, thumbnail_url)
                values (%(id)s, %(class)s, %(confidence)s, %(source)s, %(timestamp)s, %(bin_group)s, %(status)s, %(user_id)s, %(bin_id)s, %(image_name)s, %(image_url)s, %(thumbnail_url)s)
                on conflict (id) do update set class = excluded.class, confidence = excluded.confidence, source = excluded.source, timestamp = excluded.timestamp, bin_group = excluded.bin_group, status = excluded.status, user_id = excluded.user_id, bin_id = excluded.bin_id, image_name = excluded.image_name, image_url = excluded.image_url, thumbnail_url = excluded.thumbnail_url
            """, dataset["predictions"])
            _upsert_many(cursor, """
                insert into recycling_submissions (id, user_id, bin_id, waste_type_id, quantity, unit, qr_token, qr_signature, status, created_at, expired_at, verified_by, verified_at, actual_quantity, volunteer_note)
                values (%(id)s, %(user_id)s, %(bin_id)s, %(waste_type_id)s, %(quantity)s, %(unit)s, %(qr_token)s, %(qr_signature)s, %(status)s, %(created_at)s, %(expired_at)s, %(verified_by)s, %(verified_at)s, %(actual_quantity)s, %(volunteer_note)s)
                on conflict (id) do update set user_id = excluded.user_id, bin_id = excluded.bin_id, waste_type_id = excluded.waste_type_id, quantity = excluded.quantity, unit = excluded.unit, qr_token = excluded.qr_token, qr_signature = excluded.qr_signature, status = excluded.status, created_at = excluded.created_at, expired_at = excluded.expired_at, verified_by = excluded.verified_by, verified_at = excluded.verified_at, actual_quantity = excluded.actual_quantity, volunteer_note = excluded.volunteer_note
            """, dataset["recycling_submissions"])
            _upsert_many(cursor, """
                insert into qr_scan_logs (id, qr_token, scanned_by, station_id, scanned_at, result, note)
                values (%(id)s, %(qr_token)s, %(scanned_by)s, %(station_id)s, %(scanned_at)s, %(result)s, %(note)s)
                on conflict (id) do update set qr_token = excluded.qr_token, scanned_by = excluded.scanned_by, station_id = excluded.station_id, scanned_at = excluded.scanned_at, result = excluded.result, note = excluded.note
            """, dataset["qr_scan_logs"])
            _upsert_many(cursor, """
                insert into proof_images (id, submission_id, image_url, image_hash, captured_at, verification_code, status, note)
                values (%(id)s, %(submission_id)s, %(image_url)s, %(image_hash)s, %(captured_at)s, %(verification_code)s, %(status)s, %(note)s)
                on conflict (id) do update set submission_id = excluded.submission_id, image_url = excluded.image_url, image_hash = excluded.image_hash, captured_at = excluded.captured_at, verification_code = excluded.verification_code, status = excluded.status, note = excluded.note
            """, dataset["proof_images"])
            _upsert_many(cursor, """
                insert into point_history (prediction_id, submission_id, user_id, bin_id, class, bin_group, action, points, timestamp, admin_note, source, description, status)
                values (%(prediction_id)s, %(submission_id)s, %(user_id)s, %(bin_id)s, %(class)s, %(bin_group)s, %(action)s, %(points)s, %(timestamp)s, %(admin_note)s, %(source)s, %(description)s, %(status)s)
            """, dataset["point_history"])
            _upsert_many(cursor, """
                insert into reward_redemptions (id, user_id, reward_id, reward_label, cost_points, status, requested_at, reviewed_at, admin_note)
                values (%(id)s, %(user_id)s, %(reward_id)s, %(reward_label)s, %(cost_points)s, %(status)s, %(requested_at)s, %(reviewed_at)s, %(admin_note)s)
                on conflict (id) do update set user_id = excluded.user_id, reward_id = excluded.reward_id, reward_label = excluded.reward_label, cost_points = excluded.cost_points, status = excluded.status, requested_at = excluded.requested_at, reviewed_at = excluded.reviewed_at, admin_note = excluded.admin_note
            """, dataset["reward_redemptions"])
            _upsert_many(cursor, """
                insert into feedback (id, user_id, user_name, category, message, status, priority, bin_id, admin_note, resolved_at, timestamp, created_at)
                values (%(id)s, %(user_id)s, %(user_name)s, %(category)s, %(message)s, %(status)s, %(priority)s, %(bin_id)s, %(admin_note)s, %(resolved_at)s, %(timestamp)s, %(created_at)s)
                on conflict (id) do update set user_id = excluded.user_id, user_name = excluded.user_name, category = excluded.category, message = excluded.message, status = excluded.status, priority = excluded.priority, bin_id = excluded.bin_id, admin_note = excluded.admin_note, resolved_at = excluded.resolved_at, timestamp = excluded.timestamp, created_at = excluded.created_at
            """, dataset["feedback"])
            _upsert_many(cursor, """
                insert into user_missions (id, user_id, mission_id, current, completed, status, updated_at)
                values (%(id)s, %(user_id)s, %(mission_id)s, %(current)s, %(completed)s, %(status)s, %(updated_at)s)
                on conflict (user_id, mission_id) do update set current = excluded.current, completed = excluded.completed, status = excluded.status, updated_at = excluded.updated_at
            """, dataset["user_missions"])
            cursor.execute("""
                insert into settings (id, threshold, model_name, class_count, updated_at)
                values (%(id)s, %(threshold)s, %(model_name)s, %(class_count)s, now())
                on conflict (id) do update set threshold = excluded.threshold, model_name = excluded.model_name, class_count = excluded.class_count, updated_at = now()
            """, dataset["settings"])
        connection.commit()

    summary = {key: (1 if key == "settings" else len(value)) for key, value in dataset.items()}
    summary["upload_files"] = files_written
    return summary


def cleanup_demo_database(database_url=None, dry_run=False):
    dataset = build_demo_dataset()
    summary = {key: (1 if key == "settings" else len(value)) for key, value in dataset.items()}
    if dry_run:
        return summary

    target_database_url = database_url or app.require_database_url()
    with psycopg.connect(target_database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(UTEHY_DEMO_CLEANUP_SQL)
        connection.commit()

    summary["upload_files_removed"] = remove_demo_upload_files()
    return summary


def main():
    parser = argparse.ArgumentParser(description="Seed realistic UTEHY demo data into Eco-loop Campus PostgreSQL.")
    parser.add_argument("--dry-run", action="store_true", help="Print summary without writing database rows.")
    args = parser.parse_args()

    summary = seed_database(dry_run=args.dry_run)
    mode = "DRY_RUN" if args.dry_run else "SEEDED"
    print(f"{mode} UTEHY demo data")
    for key in sorted(summary):
        print(f"- {key}: {summary[key]}")
    print(f"Temporary password for demo accounts: {TEMPORARY_PASSWORD}")


if __name__ == "__main__":
    main()

begin;

insert into users (id, name, email, role, status)
values
  ('E2E_STUDENT', 'E2E Student', 'e2e.student@local.test', 'student', 'active'),
  ('E2E_VOLUNTEER', 'E2E Volunteer', 'e2e.volunteer@local.test', 'volunteer', 'active');

insert into bins (id, name, bin_group, location, qr_code, status, capacity, map_x, map_y)
values ('E2E_BIN', 'E2E Bin', 'Tái chế', 'E2E Location', 'ECL-ST-E2E-BIN', 'active', 10, 50, 50);

insert into waste_types (id, name, unit, point_per_unit, status)
values ('E2E_PAPER', 'Giấy', 'kg', 5, 'active');

create temporary table _e2e_submission as
select create_recycling_submission('E2E_STUDENT', 'E2E_BIN', 'E2E_PAPER', 2) as payload;

do $$
declare
  v_payload jsonb;
  v_scan jsonb;
  v_confirm jsonb;
  v_submission_id text;
  v_points integer;
begin
  select payload into v_payload from _e2e_submission;
  v_submission_id := v_payload ->> 'id';

  v_scan := scan_recycling_qr(v_payload ->> 'qrToken', 'E2E_VOLUNTEER', 'E2E_BIN');
  if v_scan ->> 'result' <> 'SUCCESS' then
    raise exception 'Expected SUCCESS, got %', v_scan;
  end if;

  insert into proof_images (submission_id, image_url, status)
  values (v_submission_id, 'local://e2e-proof.jpg', 'accepted');

  v_confirm := confirm_recycling_submission(v_submission_id, 'E2E_VOLUNTEER', 2, 'E2E smoke');
  if v_confirm ->> 'status' <> 'POINT_CONFIRMED' then
    raise exception 'Expected POINT_CONFIRMED, got %', v_confirm;
  end if;

  select points into v_points from users where id = 'E2E_STUDENT';
  if v_points <> 10 then
    raise exception 'Expected 10 points, got %', v_points;
  end if;
end $$;

rollback;

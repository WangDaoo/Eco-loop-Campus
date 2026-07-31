import { getFeedbackPriorityLabel, getFeedbackStatusLabel, isOpenFeedback, normalizeFeedback } from "./feedbackConfig";

test("normalizes unknown feedback status and priority to safe defaults", () => {
  const feedback = normalizeFeedback({
    id: "FB-DIRTY-CODES",
    userName: "Sinh viên dữ liệu bẩn",
    message: "Status và priority ngoài allowlist.",
    status: " DONE ",
    priority: " URGENT ",
  });

  expect(feedback.status).toBe("unread");
  expect(feedback.priority).toBe("medium");
  expect(isOpenFeedback(feedback)).toBe(true);
  expect(getFeedbackStatusLabel(feedback.status)).toBe("Chưa xử lý");
  expect(getFeedbackPriorityLabel(feedback.priority)).toBe("Trung bình");
});

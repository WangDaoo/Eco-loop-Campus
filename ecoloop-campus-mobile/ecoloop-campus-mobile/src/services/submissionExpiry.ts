export type SubmissionExpiryInfo = {
  expired: boolean;
  label: string;
  detail: string;
};

const deadlineFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

function validDate(value: Date) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function remainingLabel(totalMinutes: number) {
  if (totalMinutes < 60) return `Còn ${totalMinutes} phút`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `Còn ${hours} giờ ${minutes} phút` : `Còn ${hours} giờ`;
}

export function getSubmissionExpiryInfo(expiredAt: Date, now = new Date()): SubmissionExpiryInfo {
  if (!validDate(expiredAt) || !validDate(now)) {
    return {
      expired: true,
      label: 'Không rõ thời hạn QR',
      detail: 'Tạo mã QR mới để gửi lại tại trạm.'
    };
  }

  const diffMs = expiredAt.getTime() - now.getTime();
  if (diffMs <= 0) {
    return {
      expired: true,
      label: 'Mã QR đã hết hạn',
      detail: 'Tạo mã QR mới để gửi lại tại trạm.'
    };
  }

  const totalMinutes = Math.max(1, Math.ceil(diffMs / 60000));
  return {
    expired: false,
    label: remainingLabel(totalMinutes),
    detail: `Có hiệu lực đến ${deadlineFormatter.format(expiredAt)}`
  };
}

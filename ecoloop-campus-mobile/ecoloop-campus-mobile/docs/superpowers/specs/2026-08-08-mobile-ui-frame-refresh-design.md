# Mobile UI Frame Refresh Design

## Muc tieu

Giu template goc cua app Eco-loop Campus Mobile, khong doi navigation, Supabase, QR, AI va luong nghiep vu. Nang khung giao dien de app trong hoan chinh hon, bam tinh than template tham khao: pastel, bubble, card mem, bottom nav noi bat.

## Pham vi

- Giu Student tabs: Home, Map, Submit, History, Profile.
- Giu Volunteer tabs: Duty, Scanner, History, Profile.
- Nang theme token, card, button, screen shell va tab bar.
- Dong bo cac man chinh: Login, Home, Submit, Scanner, Map, Rewards, History, Volunteer duty.
- Sua chu tieng Viet mojibake trong cac file duoc chinh.

## Huong thiet ke

- Nen hong pastel `#FFD8D0`.
- Card chinh cyan/blue mem `#7CE3FC` va surface trang/kem.
- Accent coral cho CTA, xanh la cho diem/eco state.
- Shadow clay nhe, border radius lon nhung khong pha layout hien tai.
- Button co press feedback va touch target toi thieu 44pt.
- Bottom tab co nen coral bo tron, nut Submit/Scanner o giua noi bat hon.

## Ranh gioi khong doi

- Khong doi database/schema.
- Khong doi service Supabase, mock service, AI `/predict`.
- Khong doi route name hoac role flow.
- Khong copy web template vao React Native.

## Kiem thu

- Chay `npm run typecheck`.
- Chay `npm test`.
- Neu co thoi gian, mo app tren LDPlayer de xem Login/Home/Submit/Scanner/Map.

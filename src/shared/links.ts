// Link ra ngoài trang — một chỗ cho cả trang chủ, trang cung, lời mời vào đoàn.

import { LOCALE_INFO } from '../i18n/locales.ts'
import type { Locale } from '../i18n/locales.ts'

export const STORE_URL = 'https://apps.apple.com/vn/app/waytrek/id6789542012'
export const ANDROID_PACKAGE = 'com.trek.way_trek'
export const PLAY_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`

/**
 * Link cửa hàng theo ngôn ngữ trang: App Store của nước dùng ngôn ngữ đó (app
 * phát hành ở 11 nước — trang `/vn/` mở cho người Nhật sẽ hiện bản tiếng Việt),
 * và `hl` của Google Play để trang cửa hàng hiện đúng tiếng.
 */
export const storeUrlFor = (locale: Locale): string => STORE_URL.replace('/vn/', `/${LOCALE_INFO[locale].storefront}/`)
export const playUrlFor = (locale: Locale): string => `${PLAY_URL}&hl=${LOCALE_INFO[locale].playLang}`
// Trang pháp lý nằm ở admin web (Apple giữ đúng URL này làm Privacy Policy URL).
export const PRIVACY_URL = 'https://admin.waytrek.site/privacy'
export const TERMS_URL = 'https://admin.waytrek.site/terms'
export const DELETE_ACCOUNT_URL = 'https://admin.waytrek.site/delete-account'

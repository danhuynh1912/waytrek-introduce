import { lazy } from 'react'

/** Điểm vào /plan, tải lười — bản đồ và Supabase chỉ về máy khi vào trang này. */
export const PlannerAppLazy = lazy(() => import('./PlannerApp'))

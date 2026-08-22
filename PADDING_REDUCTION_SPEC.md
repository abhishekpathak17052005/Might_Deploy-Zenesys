# Frontend Padding Reduction Spec

## Goal
Reduce excessive whitespace/padding globally across all frontend pages by modifying shared layout components only. Do NOT redesign UI, change colors, typography, or component structure.

## Current Spacing System
The frontend currently uses:
- **Header padding:** `px-4 py-3` → `md:px-6`
- **Shell padding:** `p-3` → `md:p-5`
- **Card padding:** `p-5` (throughout)
- **Main gaps:** `gap-5` (main layout), `gap-4` (sections), `gap-3` (headers)
- **Page padding:** `p-4` → `md:p-6`

---

## Changes Required

### 1. **AppShell** (`frontend/src/components/app-shell.tsx`)

**Current (Line 56-57):**
```tsx
<div className="min-h-screen bg-background p-4 md:p-6">
  <div className="mx-auto max-w-[1500px] rounded-4xl bg-surface p-3 shadow-[var(--shadow-shell)] md:p-5">
```

**Change to:**
```tsx
<div className="min-h-screen bg-background p-3 md:p-4">
  <div className="mx-auto max-w-[1500px] rounded-4xl bg-surface p-2 shadow-[var(--shadow-shell)] md:p-3">
```

**Current (Line 58):**
```tsx
<header className="mb-5 flex items-center justify-between gap-4 rounded-3xl bg-card px-4 py-3 shadow-card md:px-6">
```

**Change to:**
```tsx
<header className="mb-4 flex items-center justify-between gap-3 rounded-3xl bg-card px-3 py-2.5 shadow-card md:px-4">
```

**Current (Line 108):**
```tsx
<div className="flex gap-5 page-enter">
```

**Change to:**
```tsx
<div className="flex gap-4 page-enter">
```

**Current (Line 133):**
```tsx
<div className="mb-5 flex flex-wrap items-center justify-between gap-3">
```

**Change to:**
```tsx
<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
```

---

### 2. **Kit Components** (`frontend/src/components/kit.tsx`)

**Card (Line 12):**
```tsx
// Current
return <section className={`card-surface p-5 card-reveal ${className}`}>{children}</section>;

// Change to
return <section className={`card-surface p-4 card-reveal ${className}`}>{children}</section>;
```

**CardHead (Line 27):**
```tsx
// Current
return (
  <div className="mb-4 flex items-start justify-between gap-3">
    <div className="flex items-center gap-2.5">

// Change to
return (
  <div className="mb-3 flex items-start justify-between gap-2">
    <div className="flex items-center gap-2">
```

**StatCard (Line 66):**
```tsx
// Current
className={`card-surface p-5 card-reveal card-interactive ${deep ? "bg-primary-deep text-primary-foreground" : ""}`}

// Change to
className={`card-surface p-4 card-reveal card-interactive ${deep ? "bg-primary-deep text-primary-foreground" : ""}`}
```

**CheckRow (Line 115):**
```tsx
// Current
<div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">

// Change to
<div className="flex items-center justify-between border-b border-border py-2 last:border-0">
```

**Field (Line 124):**
```tsx
// Current
<div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">

// Change to
<div className="flex items-center justify-between border-b border-border py-2 last:border-0">
```

---

## Summary of Changes

| Component | Property | Current | New | Notes |
|-----------|----------|---------|-----|-------|
| Shell outer | `p-` | `p-4 md:p-6` | `p-3 md:p-4` | Reduces page padding |
| Shell inner | `p-` | `p-3 md:p-5` | `p-2 md:p-3` | Reduces card wrapper |
| Header | `px- py- mb- gap-` | `px-4 py-3 md:px-6 mb-5 gap-4` | `px-3 py-2.5 md:px-4 mb-4 gap-3` | Reduces header spacing |
| Main layout | `gap-` | `gap-5` | `gap-4` | Reduces main section gaps |
| Page title | `mb- gap-` | `mb-5 gap-3` | `mb-4 gap-2` | Reduces title section spacing |
| Card | `p-` | `p-5` | `p-4` | Reduces card internal padding |
| CardHead | `mb- gap-` | `mb-4 gap-3 gap-2.5` | `mb-3 gap-2 gap-2` | Reduces card header spacing |
| StatCard | `p-` | `p-5` | `p-4` | Reduces stat card padding |
| Rows | `py-` | `py-2.5` | `py-2` | Reduces row vertical spacing |

---

## Implementation Strategy

1. **File 1:** Update `frontend/src/components/app-shell.tsx` (6 changes)
2. **File 2:** Update `frontend/src/components/kit.tsx` (7 changes)
3. **Verification:** Check all pages render correctly after changes
   - `/procurement/dashboard` - Should show compact layout
   - `/procurement/invoices` - Table rows should be tighter
   - `/finance/dashboard` - Stats cards should be more compact
   - `/finance/review` - Invoice details should have reduced padding

---

## Testing Checklist

After changes, verify:
- [ ] Header height is visually reduced
- [ ] Cards are more compact but still readable
- [ ] Gaps between sections are tighter
- [ ] Content is not cramped or overlapping
- [ ] Responsive breakpoints still work (mobile view)
- [ ] All pages load without errors
- [ ] Component spacing is consistent across all pages


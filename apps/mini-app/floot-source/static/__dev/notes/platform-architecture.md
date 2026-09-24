PULSE.DV platform architecture — 2026-09-19

Core domain chain: Developer -> Property(Project/ЖК) -> Building -> Unit -> Offer -> ClientProfile -> Match -> Lead -> Deal.

Database foundation now exists for developers, buildings, units, offers, client_profiles, matches, deals, lead_history, promo_banners, analytics_events and import_runs. Existing properties table remains the public Project/ЖК table for backward compatibility. Properties can link to developer_id.

Lead pipeline: new -> qualified -> selection_sent -> interested -> meeting -> booking -> deal / lost. Leads retain legacy status and now also have pipeline_status, manager_user_id, qualification_label and qualification_note. Existing simple lead submissions remain compatible; expanded selection flow can send purchase/mortgage qualification fields.

Team role target: owner/admin/manager/content/analyst. Current legacy users.role admin/user remains for auth compatibility; users.team_role is the granular future permission layer. All admin writes must be checked server-side.

Client IA: bottom nav is Home / Catalog / Selection / Favorites. Map is not a top-level destination. Catalog owns list/map presentation using ?view=map and shared filters. Legacy /map redirects client-side to /catalog?view=map.

Onboarding: two fixed 100dvh white/red editorial screens, first-run only via localStorage pulse_onboarding_version=1. Assets are /_cdn/static/41ea2248-5a3f-411f-bce9-ede09a87482b.png and /_cdn/static/95a8cc5e-0956-442d-9184-bf81fa7d554a.png. Art direction must stay aligned with the approved render: white canvas, red PULSE.DV mark, premium architectural editorial illustration, strong centered copy, red CTA, no landscape photography.

Control Center target modules: Dashboard, Leads, Deals, Developers, Projects, Buildings, Units, Offers, Content/Banners, Selections, Imports, Analytics, Team/Roles, Settings. Current stage includes shell navigation, live KPI endpoint and existing project editor/leads list. Next build should turn Developers/Units/Offers/Content into real CRUD modules and add lead detail/status actions.

Import target: CSV first, API adapters later. Every imported unit uses data_source/source_updated_at; import_runs tracks totals/errors. Never surface stale availability as guaranteed.

Analytics event vocabulary: view_project, view_unit, save_unit, request_selection, lead_created, selection_sent, offer_opened, booking_requested. analytics_events is ready for event ingestion endpoint later.

Scale principle: city/region are data, never hardcoded business logic. Same backend should support Primorsky Krai, then Khabarovsk/Sakhalin/Amur/Kamchatka/Yakutia and later native/web clients.
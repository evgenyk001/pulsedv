-- Add the referral campaign once without replacing the owner's other campaigns.
update app_config
set document=jsonb_set(document,'{banners}',coalesce(document->'banners','[]'::jsonb) || '[{"id":"partner-program","title":"Зарабатывайте с PULSE","body":"Знакомый ищет квартиру? Пригласите его и получите вознаграждение после сделки.","imageUrl":"https://evgenyk001.github.io/pulsedv/mini-app/_cdn/static/partner-referral.webp","ctaLabel":"Стать партнёром","actionUrl":"/partners","city":"","audience":"","kind":"partner","eyebrow":"РЕКОМЕНДУЙТЕ PULSE","enabled":true,"sortOrder":0}]'::jsonb),
    version=version+1, updated_at=now()
where not exists (select 1 from jsonb_array_elements(coalesce(document->'banners','[]'::jsonb)) b where b->>'id'='partner-program');

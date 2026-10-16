-- Reserve a normalized phone before the buyer submits. Every request uses the same
-- buyer advisory lock; the partial unique index is the final concurrency guard.
create table partner_client_reservations (
 id uuid primary key,
 partner_id uuid not null references partner_profiles(id),
 invitation_id uuid not null unique references partner_invitations(id),
 normalized_phone text check(normalized_phone ~ '^\+[1-9][0-9]{9,14}$'),
 consent_declared_at timestamptz not null default now(),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default now()+interval '7 days',
 released_at timestamptz,
 converted_referral_id uuid unique references partner_referrals(id),
 check(expires_at>created_at)
);
create unique index partner_reservations_one_phone on partner_client_reservations(normalized_phone) where released_at is null and converted_referral_id is null;
create index partner_reservations_partner on partner_client_reservations(partner_id,created_at desc);
-- Child identifiers belong to a property, including IDs supplied by importers.
alter table catalog_property_images drop constraint catalog_property_images_pkey;
alter table catalog_property_images add primary key(property_id,id);
alter table catalog_property_features drop constraint catalog_property_features_pkey;
alter table catalog_property_features add primary key(property_id,id);
alter table catalog_property_floorplans drop constraint catalog_property_floorplans_pkey;
alter table catalog_property_floorplans add primary key(property_id,id);
alter table catalog_property_documents drop constraint catalog_property_documents_pkey;
alter table catalog_property_documents add primary key(property_id,id);

alter table partner_profiles add column identity_check_day date;
alter table partner_profiles add column identity_check_count integer not null default 0 check(identity_check_count>=0);

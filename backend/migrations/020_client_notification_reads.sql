-- Read receipts belong to the authenticated visitor or bound Telegram user.
create table client_notification_reads (
 owner text not null,
 notice_id text not null,
 read_at timestamptz not null default now(),
 primary key (owner,notice_id)
);

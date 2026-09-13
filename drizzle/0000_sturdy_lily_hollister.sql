CREATE TABLE `archive_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`source_path` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`media_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_archive_assets_source_path` ON `archive_assets` (`source_path`);--> statement-breakpoint
CREATE TABLE `archive_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`notion_id` text,
	`parent_id` text,
	`title` text NOT NULL,
	`content_md` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'article' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`published_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_archive_pages_notion_id` ON `archive_pages` (`notion_id`);--> statement-breakpoint
CREATE INDEX `idx_archive_pages_parent_sort` ON `archive_pages` (`parent_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_archive_pages_status_updated` ON `archive_pages` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `archive_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `page_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`title` text NOT NULL,
	`content_md` text NOT NULL,
	`status` text NOT NULL,
	`saved_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_page_versions_page_saved` ON `page_versions` (`page_id`,`saved_at`);
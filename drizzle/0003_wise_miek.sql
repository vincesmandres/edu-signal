CREATE TABLE `credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`issuer_id` text NOT NULL,
	`title` text NOT NULL,
	`achievement` text NOT NULL,
	`verification_code` text NOT NULL,
	`credential_json` text NOT NULL,
	`status` text DEFAULT 'issued' NOT NULL,
	`issued_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`issuer_id`) REFERENCES `educators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credentials_verification_code_unique` ON `credentials` (`verification_code`);--> statement-breakpoint
CREATE INDEX `idx_credentials_student_issued` ON `credentials` (`student_id`,`issued_at`);--> statement-breakpoint
CREATE TABLE `evaluation_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`evaluation_id` text NOT NULL,
	`criterion_id` text NOT NULL,
	`score` text NOT NULL,
	`feedback` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`criterion_id`) REFERENCES `rubric_criteria`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_evaluation_scores_evaluation` ON `evaluation_scores` (`evaluation_id`);
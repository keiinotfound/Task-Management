package model

import "time"

type Task struct {
	ID           int64      `json:"id"`
	UserID       int64      `json:"user_id"`
	CategoryID   *int64     `json:"category_id"`
	CategoryName *string    `json:"category_name,omitempty"`
	Title        string     `json:"title"`
	Description  *string    `json:"description"`
	Priority     string     `json:"priority"`
	Status       string     `json:"status"`
	DueDate      *string    `json:"due_date"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type UserDashboardSummary struct {
	TotalTasks      int    `json:"total_tasks"`
	TodoCount       int    `json:"todo_count"`
	InProgressCount int    `json:"in_progress_count"`
	DoneCount       int    `json:"done_count"`
	UpcomingTasks   []Task `json:"upcoming_tasks"`
}
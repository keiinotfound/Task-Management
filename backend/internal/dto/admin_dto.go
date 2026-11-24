package dto

import "time"

type AdminUserFilterParams struct {
	Page      int
	Limit     int
	Search    string
	Role      string
	IsActive  *bool
	SortBy    string
	SortOrder string
}

type AdminUserItem struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type AdminUserDetailResponse struct {
	User        AdminUserItem `json:"user"`
	TaskSummary struct {
		Total      int `json:"total"`
		Todo       int `json:"todo"`
		InProgress int `json:"in_progress"`
		Done       int `json:"done"`
	} `json:"task_summary"`
}

type UpdateUserRoleRequest struct {
	Role string `json:"role" binding:"required"`
}

type UpdateUserStatusRequest struct {
	IsActive *bool `json:"is_active" binding:"required"`
}

type AdminTaskFilterParams struct {
	Page      int
	Limit     int
	Search    string
	UserID    *int64
	Status    string
	Priority  string
	SortBy    string
	SortOrder string
}

type AdminTaskItem struct {
	ID           int64     `json:"id"`
	UserID       int64     `json:"user_id"`
	OwnerName    string    `json:"owner_name"`
	OwnerEmail   string    `json:"owner_email"`
	CategoryID   *int64    `json:"category_id"`
	CategoryName *string   `json:"category_name"`
	Title        string    `json:"title"`
	Description  *string   `json:"description"`
	Priority     string    `json:"priority"`
	Status       string    `json:"status"`
	DueDate      *string   `json:"due_date"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type AdminDashboardSummary struct {
	TotalUsers        int             `json:"total_users"`
	ActiveUsers       int             `json:"active_users"`
	InactiveUsers     int             `json:"inactive_users"`
	TotalAdmins       int             `json:"total_admins"`
	NewUsersLast7Days int             `json:"new_users_last_7_days"`
	TotalTasks        int             `json:"total_tasks"`
	TasksByStatus     map[string]int  `json:"tasks_by_status"`
	RecentUsers       []AdminUserItem `json:"recent_users"`
}
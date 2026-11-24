package dto

type CreateTaskRequest struct {
	Title       string  `json:"title" binding:"required,min=1,max=200"`
	Description *string `json:"description"`
	CategoryID  *int64  `json:"category_id"`
	Priority    string  `json:"priority"`
	Status      string  `json:"status"`
	DueDate     *string `json:"due_date"`
}

type UpdateTaskRequest struct {
	Title       string  `json:"title" binding:"required,min=1,max=200"`
	Description *string `json:"description"`
	CategoryID  *int64  `json:"category_id"`
	Priority    string  `json:"priority" binding:"required"`
	Status      string  `json:"status" binding:"required"`
	DueDate     *string `json:"due_date"`
}

type TaskFilterParams struct {
	Page       int
	Limit      int
	Search     string
	Status     string
	Priority   string
	CategoryID *int64
	SortBy     string
	SortOrder  string
}

type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int         `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"total_pages"`
}
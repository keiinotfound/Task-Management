package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strings"

	"task-management-api/internal/dto"
	"task-management-api/internal/model"
)

var ErrTaskNotFound = errors.New("task tidak ditemukan")

type TaskRepository struct {
	db *sql.DB
}

func NewTaskRepository(db *sql.DB) *TaskRepository {
	return &TaskRepository{db: db}
}

func (r *TaskRepository) Create(ctx context.Context, task *model.Task) error {
	query := `
		INSERT INTO tasks (user_id, category_id, title, description, priority, status, due_date)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`
	res, err := r.db.ExecContext(ctx, query,
		task.UserID,
		task.CategoryID,
		task.Title,
		task.Description,
		task.Priority,
		task.Status,
		task.DueDate,
	)
	if err != nil {
		return err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	task.ID = id
	return nil
}

func (r *TaskRepository) FindByIDAndUserID(ctx context.Context, id, userID int64) (*model.Task, error) {
	query := `
		SELECT t.id, t.user_id, t.category_id, c.name AS category_name,
		       t.title, t.description, t.priority, t.status,
		       DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
		       t.created_at, t.updated_at
		FROM tasks t
		LEFT JOIN categories c ON c.id = t.category_id
		WHERE t.id = ? AND t.user_id = ?
	`
	var t model.Task
	err := r.db.QueryRowContext(ctx, query, id, userID).Scan(
		&t.ID, &t.UserID, &t.CategoryID, &t.CategoryName,
		&t.Title, &t.Description, &t.Priority, &t.Status,
		&t.DueDate, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrTaskNotFound
		}
		return nil, err
	}
	return &t, nil
}

func (r *TaskRepository) FindAllByUserID(ctx context.Context, userID int64, params dto.TaskFilterParams) (*dto.PaginatedResponse, error) {
	whereClauses := []string{"t.user_id = ?"}
	args := []interface{}{userID}

	if params.Search != "" {
		whereClauses = append(whereClauses, "t.title LIKE ?")
		args = append(args, "%"+params.Search+"%")
	}
	if params.Status != "" {
		whereClauses = append(whereClauses, "t.status = ?")
		args = append(args, params.Status)
	}
	if params.Priority != "" {
		whereClauses = append(whereClauses, "t.priority = ?")
		args = append(args, params.Priority)
	}
	if params.CategoryID != nil {
		whereClauses = append(whereClauses, "t.category_id = ?")
		args = append(args, *params.CategoryID)
	}

	whereSQL := "WHERE " + strings.Join(whereClauses, " AND ")

	// Hitung total data untuk pagination
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM tasks t %s", whereSQL)
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	// Whitelist sorting (Bagian 5.6 & 8.1)
	sortColumn := "t.created_at"
	switch params.SortBy {
	case "due_date":
		sortColumn = "t.due_date"
	case "title":
		sortColumn = "t.title"
	case "created_at":
		sortColumn = "t.created_at"
	}

	sortOrder := "DESC"
	if strings.ToUpper(params.SortOrder) == "ASC" {
		sortOrder = "ASC"
	}

	offset := (params.Page - 1) * params.Limit
	dataQuery := fmt.Sprintf(`
		SELECT t.id, t.user_id, t.category_id, c.name AS category_name,
		       t.title, t.description, t.priority, t.status,
		       DATE_FORMAT(t.due_date, '%%Y-%%m-%%d') AS due_date,
		       t.created_at, t.updated_at
		FROM tasks t
		LEFT JOIN categories c ON c.id = t.category_id
		%s
		ORDER BY %s %s
		LIMIT ? OFFSET ?
	`, whereSQL, sortColumn, sortOrder)

	queryArgs := append(args, params.Limit, offset)
	rows, err := r.db.QueryContext(ctx, dataQuery, queryArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]model.Task, 0)
	for rows.Next() {
		var t model.Task
		if err := rows.Scan(
			&t.ID, &t.UserID, &t.CategoryID, &t.CategoryName,
			&t.Title, &t.Description, &t.Priority, &t.Status,
			&t.DueDate, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	totalPages := 0
	if total > 0 {
		totalPages = int(math.Ceil(float64(total) / float64(params.Limit)))
	}

	return &dto.PaginatedResponse{
		Data:       tasks,
		Total:      total,
		Page:       params.Page,
		Limit:      params.Limit,
		TotalPages: totalPages,
	}, nil
}

func (r *TaskRepository) Update(ctx context.Context, task *model.Task) error {
	query := `
		UPDATE tasks
		SET title = ?, description = ?, category_id = ?, priority = ?, status = ?, due_date = ?, updated_at = NOW()
		WHERE id = ? AND user_id = ?
	`
	res, err := r.db.ExecContext(ctx, query,
		task.Title,
		task.Description,
		task.CategoryID,
		task.Priority,
		task.Status,
		task.DueDate,
		task.ID,
		task.UserID,
	)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrTaskNotFound
	}
	return nil
}

func (r *TaskRepository) Delete(ctx context.Context, id, userID int64) error {
	query := `DELETE FROM tasks WHERE id = ? AND user_id = ?`
	res, err := r.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrTaskNotFound
	}
	return nil
}

func (r *TaskRepository) GetDashboardSummary(ctx context.Context, userID int64) (*model.UserDashboardSummary, error) {
	summary := &model.UserDashboardSummary{
		UpcomingTasks: make([]model.Task, 0),
	}

	// Agregasi jumlah task per status (Bagian 5.2)
	countQuery := `SELECT status, COUNT(*) FROM tasks WHERE user_id = ? GROUP BY status`
	rows, err := r.db.QueryContext(ctx, countQuery, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		summary.TotalTasks += count
		switch status {
		case "TODO":
			summary.TodoCount = count
		case "IN_PROGRESS":
			summary.InProgressCount = count
		case "DONE":
			summary.DoneCount = count
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Ambil 5 task terbaru / mendekati deadline yang belum selesai
	upcomingQuery := `
		SELECT t.id, t.user_id, t.category_id, c.name AS category_name,
		       t.title, t.description, t.priority, t.status,
		       DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
		       t.created_at, t.updated_at
		FROM tasks t
		LEFT JOIN categories c ON c.id = t.category_id
		WHERE t.user_id = ? AND t.status != 'DONE'
		ORDER BY t.due_date IS NULL ASC, t.due_date ASC, t.created_at DESC
		LIMIT 5
	`
	uRows, err := r.db.QueryContext(ctx, upcomingQuery, userID)
	if err != nil {
		return nil, err
	}
	defer uRows.Close()

	for uRows.Next() {
		var t model.Task
		if err := uRows.Scan(
			&t.ID, &t.UserID, &t.CategoryID, &t.CategoryName,
			&t.Title, &t.Description, &t.Priority, &t.Status,
			&t.DueDate, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}
		summary.UpcomingTasks = append(summary.UpcomingTasks, t)
	}
	if err := uRows.Err(); err != nil {
		return nil, err
	}

	return summary, nil
}
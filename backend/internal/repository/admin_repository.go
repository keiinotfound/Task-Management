package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strings"

	"task-management-api/internal/dto"
)

var (
	ErrCannotModifySelf  = errors.New("admin tidak boleh mengubah role atau status dirinya sendiri")
	ErrLastActiveAdmin   = errors.New("sistem harus memiliki minimal satu Admin aktif")
)

type AdminRepository struct {
	db *sql.DB
}

func NewAdminRepository(db *sql.DB) *AdminRepository {
	return &AdminRepository{db: db}
}

func (r *AdminRepository) GetDashboardSummary(ctx context.Context) (*dto.AdminDashboardSummary, error) {
	summary := &dto.AdminDashboardSummary{
		TasksByStatus: map[string]int{
			"TODO":        0,
			"IN_PROGRESS": 0,
			"DONE":        0,
		},
		RecentUsers: make([]dto.AdminUserItem, 0),
	}

	// 1. Agregasi User
	userAggQuery := `
		SELECT
			COUNT(*) AS total_users,
			COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active_users,
			COALESCE(SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END), 0) AS inactive_users,
			COALESCE(SUM(CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END), 0) AS total_admins,
			COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END), 0) AS new_users_7d
		FROM users
	`
	err := r.db.QueryRowContext(ctx, userAggQuery).Scan(
		&summary.TotalUsers,
		&summary.ActiveUsers,
		&summary.InactiveUsers,
		&summary.TotalAdmins,
		&summary.NewUsersLast7Days,
	)
	if err != nil {
		return nil, err
	}

	// 2. Agregasi Task per Status (GROUP BY - Bagian 8.2)
	taskAggQuery := `SELECT status, COUNT(*) FROM tasks GROUP BY status`
	rows, err := r.db.QueryContext(ctx, taskAggQuery)
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
		summary.TasksByStatus[status] = count
		summary.TotalTasks += count
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// 3. Daftar 5 user terbaru
	recentQuery := `
		SELECT id, name, email, role, is_active, created_at, updated_at
		FROM users
		ORDER BY created_at DESC
		LIMIT 5
	`
	uRows, err := r.db.QueryContext(ctx, recentQuery)
	if err != nil {
		return nil, err
	}
	defer uRows.Close()

	for uRows.Next() {
		var u dto.AdminUserItem
		if err := uRows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		summary.RecentUsers = append(summary.RecentUsers, u)
	}
	if err := uRows.Err(); err != nil {
		return nil, err
	}

	return summary, nil
}

func (r *AdminRepository) GetUsers(ctx context.Context, params dto.AdminUserFilterParams) (*dto.PaginatedResponse, error) {
	whereClauses := []string{"1=1"}
	args := []interface{}{}

	if params.Search != "" {
		whereClauses = append(whereClauses, "(name LIKE ? OR email LIKE ?)")
		keyword := "%" + params.Search + "%"
		args = append(args, keyword, keyword)
	}
	if params.Role != "" {
		whereClauses = append(whereClauses, "role = ?")
		args = append(args, params.Role)
	}
	if params.IsActive != nil {
		whereClauses = append(whereClauses, "is_active = ?")
		args = append(args, *params.IsActive)
	}

	whereSQL := "WHERE " + strings.Join(whereClauses, " AND ")

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM users %s", whereSQL)
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	sortColumn := "created_at"
	if params.SortBy == "name" {
		sortColumn = "name"
	}

	sortOrder := "DESC"
	if strings.ToUpper(params.SortOrder) == "ASC" {
		sortOrder = "ASC"
	}

	offset := (params.Page - 1) * params.Limit
	dataQuery := fmt.Sprintf(`
		SELECT id, name, email, role, is_active, created_at, updated_at
		FROM users
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

	users := make([]dto.AdminUserItem, 0)
	for rows.Next() {
		var u dto.AdminUserItem
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	totalPages := 0
	if total > 0 {
		totalPages = int(math.Ceil(float64(total) / float64(params.Limit)))
	}

	return &dto.PaginatedResponse{
		Data:       users,
		Total:      total,
		Page:       params.Page,
		Limit:      params.Limit,
		TotalPages: totalPages,
	}, nil
}

func (r *AdminRepository) GetUserDetail(ctx context.Context, userID int64) (*dto.AdminUserDetailResponse, error) {
	var detail dto.AdminUserDetailResponse
	userQuery := `SELECT id, name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?`
	err := r.db.QueryRowContext(ctx, userQuery, userID).Scan(
		&detail.User.ID,
		&detail.User.Name,
		&detail.User.Email,
		&detail.User.Role,
		&detail.User.IsActive,
		&detail.User.CreatedAt,
		&detail.User.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	taskQuery := `SELECT status, COUNT(*) FROM tasks WHERE user_id = ? GROUP BY status`
	rows, err := r.db.QueryContext(ctx, taskQuery, userID)
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
		detail.TaskSummary.Total += count
		switch status {
		case "TODO":
			detail.TaskSummary.Todo = count
		case "IN_PROGRESS":
			detail.TaskSummary.InProgress = count
		case "DONE":
			detail.TaskSummary.Done = count
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &detail, nil
}

// UpdateUserRole menggunakan transaksi SQL untuk menjaga minimal 1 Admin aktif (Bagian 8.2)
func (r *AdminRepository) UpdateUserRole(ctx context.Context, actorAdminID, targetUserID int64, newRole string) error {
	if actorAdminID == targetUserID {
		return ErrCannotModifySelf
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var currentRole string
	var isActive bool
	err = tx.QueryRowContext(ctx, `SELECT role, is_active FROM users WHERE id = ? FOR UPDATE`, targetUserID).Scan(&currentRole, &isActive)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return err
	}

	if currentRole == "ADMIN" && isActive && newRole != "ADMIN" {
		var activeAdminCount int
		err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND is_active = 1 FOR UPDATE`).Scan(&activeAdminCount)
		if err != nil {
			return err
		}
		if activeAdminCount <= 1 {
			return ErrLastActiveAdmin
		}
	}

	_, err = tx.ExecContext(ctx, `UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?`, newRole, targetUserID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// UpdateUserStatus menggunakan transaksi SQL untuk menjaga minimal 1 Admin aktif (Bagian 8.2)
func (r *AdminRepository) UpdateUserStatus(ctx context.Context, actorAdminID, targetUserID int64, newStatus bool) error {
	if actorAdminID == targetUserID {
		return ErrCannotModifySelf
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var currentRole string
	var currentActive bool
	err = tx.QueryRowContext(ctx, `SELECT role, is_active FROM users WHERE id = ? FOR UPDATE`, targetUserID).Scan(&currentRole, &currentActive)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return err
	}

	if currentRole == "ADMIN" && currentActive && !newStatus {
		var activeAdminCount int
		err = tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND is_active = 1 FOR UPDATE`).Scan(&activeAdminCount)
		if err != nil {
			return err
		}
		if activeAdminCount <= 1 {
			return ErrLastActiveAdmin
		}
	}

	_, err = tx.ExecContext(ctx, `UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?`, newStatus, targetUserID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// GetAllTasks mengambil seluruh task lintas user dengan JOIN ke tabel users (Bagian 5.8 & 8.2)
func (r *AdminRepository) GetAllTasks(ctx context.Context, params dto.AdminTaskFilterParams) (*dto.PaginatedResponse, error) {
	whereClauses := []string{"1=1"}
	args := []interface{}{}

	if params.Search != "" {
		whereClauses = append(whereClauses, "(t.title LIKE ? OR u.name LIKE ?)")
		keyword := "%" + params.Search + "%"
		args = append(args, keyword, keyword)
	}
	if params.UserID != nil {
		whereClauses = append(whereClauses, "t.user_id = ?")
		args = append(args, *params.UserID)
	}
	if params.Status != "" {
		whereClauses = append(whereClauses, "t.status = ?")
		args = append(args, params.Status)
	}
	if params.Priority != "" {
		whereClauses = append(whereClauses, "t.priority = ?")
		args = append(args, params.Priority)
	}

	whereSQL := "WHERE " + strings.Join(whereClauses, " AND ")

	var total int
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM tasks t
		JOIN users u ON u.id = t.user_id
		%s
	`, whereSQL)
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

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
		SELECT t.id, t.user_id, u.name AS owner_name, u.email AS owner_email,
		       t.category_id, c.name AS category_name,
		       t.title, t.description, t.priority, t.status,
		       DATE_FORMAT(t.due_date, '%%Y-%%m-%%d') AS due_date,
		       t.created_at, t.updated_at
		FROM tasks t
		JOIN users u ON u.id = t.user_id
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

	tasks := make([]dto.AdminTaskItem, 0)
	for rows.Next() {
		var t dto.AdminTaskItem
		if err := rows.Scan(
			&t.ID, &t.UserID, &t.OwnerName, &t.OwnerEmail,
			&t.CategoryID, &t.CategoryName,
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

func (r *AdminRepository) GetTaskByID(ctx context.Context, taskID int64) (*dto.AdminTaskItem, error) {
	query := `
		SELECT t.id, t.user_id, u.name AS owner_name, u.email AS owner_email,
		       t.category_id, c.name AS category_name,
		       t.title, t.description, t.priority, t.status,
		       DATE_FORMAT(t.due_date, '%Y-%m-%d') AS due_date,
		       t.created_at, t.updated_at
		FROM tasks t
		JOIN users u ON u.id = t.user_id
		LEFT JOIN categories c ON c.id = t.category_id
		WHERE t.id = ?
	`
	var t dto.AdminTaskItem
	err := r.db.QueryRowContext(ctx, query, taskID).Scan(
		&t.ID, &t.UserID, &t.OwnerName, &t.OwnerEmail,
		&t.CategoryID, &t.CategoryName,
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
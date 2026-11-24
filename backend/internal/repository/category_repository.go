package repository

import (
	"context"
	"database/sql"
	"errors"

	"task-management-api/internal/model"
)

var (
	ErrCategoryNotFound      = errors.New("kategori tidak ditemukan")
	ErrCategoryAlreadyExists = errors.New("nama kategori sudah ada")
)

type CategoryRepository struct {
	db *sql.DB
}

func NewCategoryRepository(db *sql.DB) *CategoryRepository {
	return &CategoryRepository{db: db}
}

func (r *CategoryRepository) Create(ctx context.Context, cat *model.Category) error {
	// Cek apakah nama kategori sudah dipakai oleh user yang sama
	var exists int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(1) FROM categories WHERE user_id = ? AND name = ?", cat.UserID, cat.Name).Scan(&exists)
	if err != nil {
		return err
	}
	if exists > 0 {
		return ErrCategoryAlreadyExists
	}

	query := `INSERT INTO categories (user_id, name) VALUES (?, ?)`
	res, err := r.db.ExecContext(ctx, query, cat.UserID, cat.Name)
	if err != nil {
		return err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	cat.ID = id
	return nil
}

func (r *CategoryRepository) FindAllByUserID(ctx context.Context, userID int64) ([]model.Category, error) {
	query := `SELECT id, user_id, name, created_at, updated_at FROM categories WHERE user_id = ? ORDER BY name ASC`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]model.Category, 0)
	for rows.Next() {
		var c model.Category
		if err := rows.Scan(&c.ID, &c.UserID, &c.Name, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		categories = append(categories, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return categories, nil
}

func (r *CategoryRepository) FindByIDAndUserID(ctx context.Context, id, userID int64) (*model.Category, error) {
	query := `SELECT id, user_id, name, created_at, updated_at FROM categories WHERE id = ? AND user_id = ?`
	var c model.Category
	err := r.db.QueryRowContext(ctx, query, id, userID).Scan(&c.ID, &c.UserID, &c.Name, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCategoryNotFound
		}
		return nil, err
	}
	return &c, nil
}

func (r *CategoryRepository) Update(ctx context.Context, id, userID int64, name string) (*model.Category, error) {
	// Pastikan kategori ada dan milik user ini
	existing, err := r.FindByIDAndUserID(ctx, id, userID)
	if err != nil {
		return nil, err
	}

	// Cek duplikasi nama kategori lain milik user ini
	var exists int
	err = r.db.QueryRowContext(ctx, "SELECT COUNT(1) FROM categories WHERE user_id = ? AND name = ? AND id != ?", userID, name, id).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if exists > 0 {
		return nil, ErrCategoryAlreadyExists
	}

	query := `UPDATE categories SET name = ?, updated_at = NOW() WHERE id = ? AND user_id = ?`
	_, err = r.db.ExecContext(ctx, query, name, id, userID)
	if err != nil {
		return nil, err
	}

	existing.Name = name
	return existing, nil
}

func (r *CategoryRepository) Delete(ctx context.Context, id, userID int64) error {
	query := `DELETE FROM categories WHERE id = ? AND user_id = ?`
	res, err := r.db.ExecContext(ctx, query, id, userID)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrCategoryNotFound
	}
	return nil
}
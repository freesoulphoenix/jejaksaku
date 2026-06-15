import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { createCategory, deleteCategory, getCategories, updateCategory } from '../services/categoryService.js';
import { getCategoryOptions, getParentCategoryOptions } from '../utils/categoryOptions.js';

const emptyCategoryForm = {
  id: null,
  name: '',
  type: 'expense',
  parent_category_id: ''
};

export default function SettingsPage({ onLogout, user }) {
  const { language, setLanguage, supportedLanguages } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [categoryMessage, setCategoryMessage] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const parentCategories = useMemo(() => (
    getParentCategoryOptions(categories, categoryForm.type)
  ), [categories, categoryForm.type]);
  const categoryOptions = useMemo(() => getCategoryOptions(categories, null), [categories]);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const data = await getCategories();
      setCategories(data || []);
    } catch (error) {
      setCategoryError(error.message);
    }
  }

  function updateCategoryForm(field, value) {
    setCategoryForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'type' ? { parent_category_id: '' } : {})
    }));
  }

  function editCategory(category) {
    setCategoryForm({
      id: category.id,
      name: category.name,
      type: category.type || 'expense',
      parent_category_id: category.parent_category_id || ''
    });
    setCategoryMessage('');
    setCategoryError('');
  }

  function resetCategoryForm() {
    setCategoryForm(emptyCategoryForm);
  }

  async function saveCategory(event) {
    event.preventDefault();
    setCategoryMessage('');
    setCategoryError('');

    if (!categoryForm.name.trim()) {
      setCategoryError('Category name is required.');
      return;
    }

    setIsSavingCategory(true);

    try {
      if (categoryForm.id) {
        await updateCategory(categoryForm.id, categoryForm);
        setCategoryMessage('Category updated.');
      } else {
        await createCategory(categoryForm);
        setCategoryMessage('Category added.');
      }

      resetCategoryForm();
      await loadCategories();
    } catch (error) {
      setCategoryError(error.message);
    } finally {
      setIsSavingCategory(false);
    }
  }

  async function removeCategory(category) {
    const childCount = categories.filter((item) => item.parent_category_id === category.id).length;
    const message = childCount
      ? `Delete "${category.name}" and its ${childCount} child categories?`
      : `Delete "${category.name}"?`;

    if (!window.confirm(message)) {
      return;
    }

    setCategoryMessage('');
    setCategoryError('');

    try {
      await deleteCategory(category.id);
      await loadCategories();
      setCategoryMessage('Category deleted.');
    } catch (error) {
      setCategoryError(error.message);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="section-kicker">Preferences</p>
          <h1>Settings</h1>
        </div>
      </section>

      <section className="settings-grid">
        <article className="panel">
          <h2>Account</h2>
          <p className="muted-copy">{user?.email}</p>
          <div className="button-row">
            <button className="secondary-button" onClick={onLogout}>Logout</button>
          </div>
        </article>

        <article className="panel">
          <h2>Language</h2>
          <label className="field-group">
            App language
            <select onChange={(event) => setLanguage(event.target.value)} value={language}>
              {supportedLanguages.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
          </label>
          <p className="muted-copy">This saves your language preference for the app.</p>
        </article>

        <article className="panel settings-panel-wide">
          <h2>Categories</h2>
          <form className="category-manager-form" onSubmit={saveCategory}>
            <label className="field-group">
              Name
              <input
                onChange={(event) => updateCategoryForm('name', event.target.value)}
                placeholder="Category name"
                value={categoryForm.name}
              />
            </label>
            <label className="field-group">
              Type
              <select onChange={(event) => updateCategoryForm('type', event.target.value)} value={categoryForm.type}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label className="field-group">
              Parent
              <select
                onChange={(event) => updateCategoryForm('parent_category_id', event.target.value)}
                value={categoryForm.parent_category_id}
              >
                <option value="">Top-level category</option>
                {parentCategories
                  .filter((category) => category.id !== categoryForm.id)
                  .map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
              </select>
            </label>
            <div className="category-manager-actions">
              <button className="primary-button" disabled={isSavingCategory} type="submit">
                {categoryForm.id ? 'Save Category' : 'Add Category'}
              </button>
              {categoryForm.id && (
                <button className="secondary-button" onClick={resetCategoryForm} type="button">Cancel Edit</button>
              )}
            </div>
          </form>

          {categoryError && <p className="form-message error">{categoryError}</p>}
          {categoryMessage && <p className="form-message success">{categoryMessage}</p>}

          <div className="category-manager-list">
            {categoryOptions.map((category) => (
              <div className={category.isParent ? 'category-manager-row' : 'category-manager-row child'} key={category.id}>
                <span>
                  <strong>{category.isParent ? category.name : category.displayName}</strong>
                  <small>{category.type}</small>
                </span>
                <div className="button-row compact">
                  <button className="secondary-button small" onClick={() => editCategory(category)} type="button">Edit</button>
                  <button className="text-button danger" onClick={() => removeCategory(category)} type="button">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Receipt Storage</h2>
          <label className="setting-row">
            <span>Keep receipt image after import</span>
            <input type="checkbox" defaultChecked />
          </label>
          <label className="field-group">
            Auto-delete receipts
            <select defaultValue="never">
              <option value="never">Never</option>
              <option value="3m">After 3 months</option>
              <option value="1y">After 1 year</option>
            </select>
          </label>
        </article>

        <article className="panel">
          <h2>Backup</h2>
          <p className="muted-copy">Export and import controls will connect to Dompet Daily data services later.</p>
          <div className="button-row">
            <button className="secondary-button">Export</button>
            <button className="secondary-button">Import</button>
          </div>
        </article>
      </section>
    </div>
  );
}

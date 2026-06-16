import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { createCategory, deleteCategory, getCategories, updateCategory, updateCategoryOrder } from '../services/categoryService.js';

const emptyCategoryForm = {
  id: null,
  name: '',
  type: 'expense',
  parent_category_id: ''
};

const appVersion = '0.1.0';

function FlatIcon({ name }) {
  const commonProps = {
    'aria-hidden': 'true',
    fill: 'none',
    height: '18',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: '2',
    viewBox: '0 0 24 24',
    width: '18'
  };

  if (name === 'back') {
    return <svg {...commonProps}><path d="m15 18-6-6 6-6" /></svg>;
  }

  if (name === 'category') {
    return <svg {...commonProps}><rect height="6" rx="1.5" width="6" x="4" y="4" /><rect height="6" rx="1.5" width="6" x="14" y="4" /><rect height="6" rx="1.5" width="6" x="4" y="14" /><path d="M14 17h6" /></svg>;
  }

  if (name === 'edit') {
    return <svg {...commonProps}><path d="M12 20h9" /><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z" /></svg>;
  }

  if (name === 'grip') {
    return <svg {...commonProps}><path d="M8 6h.01" /><path d="M8 12h.01" /><path d="M8 18h.01" /><path d="M16 6h.01" /><path d="M16 12h.01" /><path d="M16 18h.01" /></svg>;
  }

  if (name === 'minus') {
    return <svg {...commonProps}><circle cx="12" cy="12" r="8" fill="currentColor" stroke="none" /><path d="M8.5 12h7" stroke="#fff" /></svg>;
  }

  if (name === 'trash') {
    return <svg {...commonProps}><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></svg>;
  }

  if (name === 'plus') {
    return <svg {...commonProps}><circle cx="12" cy="12" r="8" /><path d="M12 8v8" /><path d="M8 12h8" /></svg>;
  }

  if (name === 'up') {
    return <svg {...commonProps}><path d="m6 15 6-6 6 6" /></svg>;
  }

  if (name === 'down') {
    return <svg {...commonProps}><path d="m6 9 6 6 6-6" /></svg>;
  }

  if (name === 'user') {
    return <svg {...commonProps}><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></svg>;
  }

  if (name === 'language') {
    return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18" /><path d="M12 3a14 14 0 0 0 0 18" /></svg>;
  }

  if (name === 'info') {
    return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></svg>;
  }

  if (name === 'version') {
    return <svg {...commonProps}><path d="M7 7h10v10H7z" /><path d="M4 10h3" /><path d="M4 14h3" /><path d="M17 10h3" /><path d="M17 14h3" /></svg>;
  }

  return <svg {...commonProps}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
}

function groupCategories(categories) {
  const childrenByParentId = new Map();
  const parents = [];

  categories.forEach((category) => {
    if (category.parent_category_id) {
      const children = childrenByParentId.get(category.parent_category_id) || [];
      children.push(category);
      childrenByParentId.set(category.parent_category_id, children);
      return;
    }

    parents.push(category);
  });

  function compareCategory(a, b) {
    const aOrder = Number.isFinite(a.sort_order) ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(b.sort_order) ? b.sort_order : Number.MAX_SAFE_INTEGER;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return `${a.type}${a.name}`.localeCompare(`${b.type}${b.name}`);
  }

  parents.sort(compareCategory);
  childrenByParentId.forEach((children) => {
    children.sort(compareCategory);
  });

  return { childrenByParentId, parents };
}

export default function SettingsPage({ onDeleteAccount, onLogout, user }) {
  const { language, setLanguage, supportedLanguages } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [categoryMessage, setCategoryMessage] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [settingsView, setSettingsView] = useState('settings');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [showSubcategories, setShowSubcategories] = useState(true);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [activeSortId, setActiveSortId] = useState('');
  const [isSortingCategory, setIsSortingCategory] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const { childrenByParentId, parents } = useMemo(() => groupCategories(categories), [categories]);
  const selectedParent = useMemo(() => (
    parents.find((category) => category.id === selectedParentId) || null
  ), [parents, selectedParentId]);
  const visibleParents = useMemo(() => parents, [parents]);
  const activeParentOptions = useMemo(() => (
    parents.filter((category) => category.type === categoryForm.type && category.id !== categoryForm.id)
  ), [categoryForm.id, categoryForm.type, parents]);
  const selectedChildren = selectedParent ? childrenByParentId.get(selectedParent.id) || [] : [];

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
    setIsCategoryFormOpen(true);
    setCategoryMessage('');
    setCategoryError('');
  }

  function resetCategoryForm() {
    setCategoryForm(emptyCategoryForm);
    setIsCategoryFormOpen(false);
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
      setPendingDeleteId('');
      setActiveSortId('');
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
      setPendingDeleteId('');
      setActiveSortId('');
      if (selectedParentId === category.id) {
        setSelectedParentId('');
        setSettingsView('manager');
      }
    } catch (error) {
      setCategoryError(error.message);
    }
  }

  function openCategoryManager() {
    setSettingsView('manager');
    setSelectedParentId('');
    setCategoryMessage('');
    setCategoryError('');
    setPendingDeleteId('');
    setActiveSortId('');
    resetCategoryForm();
  }

  function closeCategoryManager() {
    setSettingsView('settings');
    setSelectedParentId('');
    setCategoryMessage('');
    setCategoryError('');
    setPendingDeleteId('');
    setActiveSortId('');
    resetCategoryForm();
  }

  function openParentCategory(category) {
    setSelectedParentId(category.id);
    setSettingsView('children');
    setPendingDeleteId('');
    setActiveSortId('');
    setCategoryMessage('');
    setCategoryError('');
    resetCategoryForm();
  }

  function addTopLevelCategory() {
    setCategoryForm(emptyCategoryForm);
    setIsCategoryFormOpen(true);
  }

  function addChildCategory() {
    setCategoryForm({
      ...emptyCategoryForm,
      type: selectedParent?.type || 'expense',
      parent_category_id: selectedParent?.id || ''
    });
    setIsCategoryFormOpen(true);
  }

  function getCategoryLabel(category) {
    return `${category.type === 'income' ? 'Income' : 'Expense'} : ${category.name}`;
  }

  async function moveCategory(category, direction, rows) {
    const currentIndex = rows.findIndex((item) => item.id === category.id);
    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= rows.length) {
      return;
    }

    const reordered = [...rows];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);

    setCategoryMessage('');
    setCategoryError('');
    setIsSortingCategory(true);

    try {
      await updateCategoryOrder(reordered);
      await loadCategories();
      setActiveSortId(category.id);
    } catch (error) {
      setCategoryError(error.message);
    } finally {
      setIsSortingCategory(false);
    }
  }

  function renderDeleteButton(category) {
    return (
      <button
        aria-label={pendingDeleteId === category.id ? `Hide delete for ${category.name}` : `Show delete for ${category.name}`}
        className="category-minus-button"
        onClick={() => setPendingDeleteId((current) => (current === category.id ? '' : category.id))}
        type="button"
      >
        <FlatIcon name="minus" />
      </button>
    );
  }

  function renderCategoryForm() {
    if (!isCategoryFormOpen) {
      return null;
    }

    return (
      <form className="category-manager-form compact" onSubmit={saveCategory}>
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
            {activeParentOptions.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <div className="category-manager-actions">
          <button className="primary-button small-action" disabled={isSavingCategory} type="submit">
            {categoryForm.id ? 'Save' : 'Add'}
          </button>
          <button className="secondary-button small-action" onClick={resetCategoryForm} type="button">Cancel</button>
        </div>
      </form>
    );
  }

  function renderCategoryManager() {
    const isChildView = settingsView === 'children' && selectedParent;
    const rows = isChildView ? selectedChildren : visibleParents;
    const handleAddCategory = isChildView ? addChildCategory : addTopLevelCategory;

    return (
      <div className="page-stack category-subpage">
        <section className="category-subpage-header">
          <button className="category-back-button" onClick={isChildView ? () => setSettingsView('manager') : closeCategoryManager} type="button">
            <FlatIcon name="back" />
            <span>Settings</span>
          </button>
        </section>

        <section className="panel category-manager-panel">
          <div className="category-manager-title-row">
            <div className="category-title-lockup">
              <span className="settings-flat-icon"><FlatIcon name="category" /></span>
              <div>
                <p className="section-kicker">Categories</p>
                <h2>{isChildView ? selectedParent.name : 'Add / remove categories'}</h2>
              </div>
            </div>

            <div className="category-header-tools">
              <button
                aria-label={isChildView ? 'Add subcategory' : 'Add top category'}
                className="category-add-button"
                onClick={handleAddCategory}
                type="button"
              >
                <FlatIcon name="plus" />
              </button>

              {!isChildView && (
                <label className="category-toggle" aria-label="Show subcategories">
                  <input
                    checked={showSubcategories}
                    onChange={(event) => setShowSubcategories(event.target.checked)}
                    type="checkbox"
                  />
                  <span />
                </label>
              )}
            </div>
          </div>

          {renderCategoryForm()}

          {categoryError && <p className="form-message error compact-message">{categoryError}</p>}
          {categoryMessage && <p className="form-message success compact-message">{categoryMessage}</p>}

          <div className="category-flat-list">
            {rows.length === 0 && (
              <p className="muted-copy category-empty-copy">No categories yet.</p>
            )}

            {rows.map((category, index) => {
              const children = childrenByParentId.get(category.id) || [];
              const preview = children.map((child) => child.name).join(', ');

              return (
                <div className={pendingDeleteId === category.id ? 'category-flat-row reveal-delete' : 'category-flat-row'} key={category.id}>
                  <div className="category-row-slide">
                    {renderDeleteButton(category)}
                    <button
                      className="category-row-main"
                      disabled
                      type="button"
                    >
                      <strong>{isChildView ? category.name : getCategoryLabel(category)}</strong>
                      {!isChildView && showSubcategories && preview && <small>{preview}</small>}
                    </button>
                    <div className="category-row-tools">
                      <button
                        className="category-icon-button"
                        aria-label={isChildView ? `Edit ${category.name}` : `Open ${category.name} subcategories`}
                        onClick={isChildView ? () => editCategory(category) : () => openParentCategory(category)}
                        type="button"
                      >
                        <FlatIcon name="edit" />
                      </button>
                      <button
                        aria-label={`Sort ${category.name}`}
                        className="category-icon-button"
                        onClick={() => setActiveSortId((current) => (current === category.id ? '' : category.id))}
                        type="button"
                      >
                        <FlatIcon name="grip" />
                      </button>
                      {activeSortId === category.id && (
                        <span className="category-sort-controls">
                          <button
                            aria-label={`Move ${category.name} up`}
                            className="category-icon-button"
                            disabled={index === 0 || isSortingCategory}
                            onClick={() => moveCategory(category, 'up', rows)}
                            type="button"
                          >
                            <FlatIcon name="up" />
                          </button>
                          <button
                            aria-label={`Move ${category.name} down`}
                            className="category-icon-button"
                            disabled={index === rows.length - 1 || isSortingCategory}
                            onClick={() => moveCategory(category, 'down', rows)}
                            type="button"
                          >
                            <FlatIcon name="down" />
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="category-delete-reveal" onClick={() => removeCategory(category)} type="button">
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  async function handleDeleteAccount(event) {
    event.preventDefault();
    setDeleteError('');

    if (deleteConfirmation !== 'CONFIRM DELETE') {
      setDeleteError('Type CONFIRM DELETE to confirm account deletion.');
      return;
    }

    setIsDeletingAccount(true);

    try {
      await onDeleteAccount();
    } catch (error) {
      setDeleteError(error.message || 'Unable to delete account.');
      setIsDeletingAccount(false);
    }
  }

  if (settingsView !== 'settings') {
    return renderCategoryManager();
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
          <div className="settings-panel-title">
            <span className="settings-flat-icon"><FlatIcon name="user" /></span>
            <h2>Account</h2>
          </div>
          <p className="muted-copy">{user?.email}</p>
          <div className="button-row">
            <button className="secondary-button" onClick={onLogout}>Logout</button>
          </div>
        </article>

        <article className="panel">
          <div className="settings-panel-title">
            <span className="settings-flat-icon"><FlatIcon name="language" /></span>
            <h2>Language</h2>
          </div>
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

        <article className="panel">
          <div className="settings-panel-title">
            <span className="settings-flat-icon"><FlatIcon name="category" /></span>
            <h2>Add Categories</h2>
          </div>
          <p className="muted-copy">Manage parent categories and subcategories.</p>
          <button className="secondary-button small-action" onClick={openCategoryManager} type="button">
            Add / remove categories
          </button>
        </article>

        <article className="panel">
          <div className="settings-panel-title">
            <span className="settings-flat-icon"><FlatIcon name="info" /></span>
            <h2>About</h2>
          </div>
          <p className="muted-copy">Dompet Daily is for expense records, receipt history, reports, and analysis.</p>
        </article>

        <article className="panel">
          <div className="settings-panel-title">
            <span className="settings-flat-icon"><FlatIcon name="version" /></span>
            <h2>Version</h2>
          </div>
          <p className="muted-copy">Dompet Daily {appVersion}</p>
        </article>

        <article className="panel settings-panel-wide">
          <div className="danger-zone standalone">
            <div>
              <h3>Delete Account</h3>
              <p>
                This permanently removes your Dompet Daily account, profile, accounts, categories,
                transactions, due reminders, receipts, statement imports, and uploaded files.
              </p>
            </div>

            {!deleteAccountOpen ? (
              <button className="secondary-button danger-button" onClick={() => setDeleteAccountOpen(true)} type="button">
                Delete Account
              </button>
            ) : (
              <form className="delete-account-form" onSubmit={handleDeleteAccount}>
                <p className="form-message error">
                  Are you sure? This cannot be undone. Type <strong>CONFIRM DELETE</strong> to continue.
                </p>
                <label className="field-group">
                  Confirmation
                  <input
                    autoComplete="off"
                    onChange={(event) => setDeleteConfirmation(event.target.value)}
                    placeholder="CONFIRM DELETE"
                    value={deleteConfirmation}
                  />
                </label>
                {deleteError && <p className="form-message error">{deleteError}</p>}
                <div className="button-row">
                  <button
                    className="primary-button danger-button"
                    disabled={isDeletingAccount || deleteConfirmation !== 'CONFIRM DELETE'}
                    type="submit"
                  >
                    {isDeletingAccount ? 'Deleting...' : 'Permanently Delete Account'}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={isDeletingAccount}
                    onClick={() => {
                      setDeleteAccountOpen(false);
                      setDeleteConfirmation('');
                      setDeleteError('');
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

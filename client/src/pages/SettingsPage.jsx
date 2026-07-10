import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext.jsx';
import { getAccounts } from '../services/accountService.js';
import { createCategory, deleteCategory, getCategories, updateCategory, updateCategoryOrder } from '../services/categoryService.js';
import { createProjectTag, deleteProjectTag, getProjectTags, updateProjectTag } from '../services/projectTagService.js';
import { getCurrentUserProfile, updateCurrentUserDefaultAccount } from '../services/userProfileService.js';

const emptyCategoryForm = {
  id: null,
  name: '',
  type: 'expense',
  parent_category_id: ''
};

const emptyProjectTagForm = {
  id: null,
  name: ''
};

const appVersion = '1.0.0';

const versionHistory = [
  {
    version: 'v1',
    title: 'Credit facilities',
    features: [
      'Added Credit Card and PayLater account support.',
      'Credit card and PayLater purchases count as spending when the purchase happens.',
      'Repayments are treated as transfers, so paying the bill does not double-count spending.',
      'Added credit limit, utilization, available credit, and alert threshold tracking.',
      'Statement import now classifies purchases, payments, refunds, fees, installments, and cash advances.'
    ]
  },
  {
    version: 'v0',
    title: 'Original Jejak Saku',
    features: [
      'Expense, income, and transfer records.',
      'Cash, bank, e-wallet, loan, investment, and PayLater account tracking.',
      'Receipt history with OCR-supported transaction records.',
      'Bank and e-wallet statement import with matching review.',
      'Reports, analysis, due reminders, categories, and project tags.'
    ]
  }
];

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

  if (name === 'categoryAdd') {
    return (
      <svg aria-hidden="true" fill="currentColor" height="22" viewBox="0 0 512 512" width="22">
        <path d="M42.67,342.55c0-35.35,28.65-64,64-64h62.78c35.35,0,64,28.65,64,64v62.78c0,35.35-28.65,64-64,64h-62.78c-35.35,0-64-28.65-64-64v-62.78ZM106.67,321.22c-11.78,0-21.33,9.55-21.33,21.33v62.78c0,11.78,9.55,21.33,21.33,21.33h62.78c11.78,0,21.33-9.55,21.33-21.33v-62.78c0-11.78-9.55-21.33-21.33-21.33h-62.78Z" />
        <path d="M278.58,106.67c0-35.35,28.65-64,64-64h62.78c35.35,0,64,28.65,64,64v62.78c0,35.35-28.65,64-64,64h-62.78c-35.35,0-64-28.65-64-64v-62.78ZM342.58,85.33c-11.78,0-21.33,9.55-21.33,21.33v62.78c0,11.78,9.55,21.33,21.33,21.33h62.78c11.78,0,21.33-9.55,21.33-21.33v-62.78c0-11.78-9.55-21.33-21.33-21.33h-62.78Z" />
        <path d="M384,277.33c11.78,0,21.33,9.55,21.33,21.33v42.67h42.67c11.78,0,21.33,9.55,21.33,21.33s-9.55,21.33-21.33,21.33h-42.67v42.67c0,11.78-9.55,21.33-21.33,21.33s-21.33-9.55-21.33-21.33v-42.67h-42.67c-11.78,0-21.33-9.55-21.33-21.33s9.55-21.33,21.33-21.33h42.67v-42.67c0-11.78,9.55-21.33,21.33-21.33Z" />
        <rect x="52.84" y="138.06" width="170.44" height="43" rx="21.39" ry="21.39" />
      </svg>
    );
  }

  if (name === 'edit') {
    return <svg {...commonProps}><path d="M12 20h9" /><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z" /></svg>;
  }

  if (name === 'grip') {
    return <svg {...commonProps}><path d="M7 8h10" /><path d="M7 12h10" /><path d="M7 16h10" /></svg>;
  }

  if (name === 'minus') {
    return <svg {...commonProps}><circle cx="12" cy="12" r="8" fill="currentColor" stroke="none" /><path d="M8.5 12h7" stroke="#fff" /></svg>;
  }

  if (name === 'trash') {
    return <svg {...commonProps}><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></svg>;
  }

  if (name === 'tag') {
    return <svg {...commonProps}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><path d="M7.5 7.5h.01" /></svg>;
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
  const [accounts, setAccounts] = useState([]);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [projectTags, setProjectTags] = useState([]);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [projectTagForm, setProjectTagForm] = useState(emptyProjectTagForm);
  const [categoryMessage, setCategoryMessage] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [projectTagMessage, setProjectTagMessage] = useState('');
  const [projectTagError, setProjectTagError] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isSavingProjectTag, setIsSavingProjectTag] = useState(false);
  const [isSavingDefaultAccount, setIsSavingDefaultAccount] = useState(false);
  const [defaultAccountMessage, setDefaultAccountMessage] = useState('');
  const [defaultAccountError, setDefaultAccountError] = useState('');
  const [settingsView, setSettingsView] = useState('settings');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [showSubcategories, setShowSubcategories] = useState(true);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [draggingCategoryId, setDraggingCategoryId] = useState('');
  const [isSortingCategory, setIsSortingCategory] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const { childrenByParentId, parents } = useMemo(() => groupCategories(categories), [categories]);
  const dragRowsRef = useRef([]);
  const dragCategoryIdRef = useRef('');
  const selectedParent = useMemo(() => (
    parents.find((category) => category.id === selectedParentId) || null
  ), [parents, selectedParentId]);
  const visibleParents = useMemo(() => parents, [parents]);
  const activeParentOptions = useMemo(() => (
    parents.filter((category) => category.type === categoryForm.type && category.id !== categoryForm.id)
  ), [categoryForm.id, categoryForm.type, parents]);
  const selectedChildren = selectedParent ? childrenByParentId.get(selectedParent.id) || [] : [];

  useEffect(() => {
    loadSettingsData();
  }, []);

  useEffect(() => {
    if (!pendingDeleteId) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (
        event.target.closest('.category-minus-button')
        || event.target.closest('.category-delete-reveal')
      ) {
        return;
      }

      setPendingDeleteId('');
    }

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [pendingDeleteId]);

  async function loadSettingsData() {
    try {
      const [accountData, categoryData, projectTagData, profileData] = await Promise.all([
        getAccounts(),
        getCategories(),
        getProjectTags(),
        getCurrentUserProfile()
      ]);
      setAccounts(accountData || []);
      setCategories(categoryData || []);
      setProjectTags(projectTagData || []);
      setCurrentProfile(profileData || null);
    } catch (error) {
      setCategoryError(error.message);
    }
  }

  async function loadCategories() {
    try {
      const data = await getCategories();
      setCategories(data || []);
    } catch (error) {
      setCategoryError(error.message);
    }
  }

  async function loadProjectTags() {
    try {
      const data = await getProjectTags();
      setProjectTags(data || []);
    } catch (error) {
      setProjectTagError(error.message);
    }
  }

  async function handleDefaultAccountChange(event) {
    const nextDefaultAccountId = event.target.value;
    setDefaultAccountMessage('');
    setDefaultAccountError('');
    setIsSavingDefaultAccount(true);

    try {
      const updatedProfile = await updateCurrentUserDefaultAccount(nextDefaultAccountId);
      setCurrentProfile(updatedProfile);
      setDefaultAccountMessage(nextDefaultAccountId ? 'Default source account saved.' : 'Default source account cleared.');
    } catch (error) {
      setDefaultAccountError(error.message || 'Unable to save default source account.');
    } finally {
      setIsSavingDefaultAccount(false);
    }
  }

  function editProjectTag(tag) {
    setProjectTagForm({
      id: tag.id,
      name: tag.name
    });
    setProjectTagMessage('');
    setProjectTagError('');
  }

  function resetProjectTagForm() {
    setProjectTagForm(emptyProjectTagForm);
  }

  async function saveProjectTag(event) {
    event.preventDefault();
    setProjectTagMessage('');
    setProjectTagError('');

    if (!projectTagForm.name.trim()) {
      setProjectTagError('Project tag name is required.');
      return;
    }

    setIsSavingProjectTag(true);

    try {
      if (projectTagForm.id) {
        await updateProjectTag(projectTagForm.id, projectTagForm.name);
        setProjectTagMessage('Project tag updated.');
      } else {
        await createProjectTag(projectTagForm.name);
        setProjectTagMessage('Project tag added.');
      }

      resetProjectTagForm();
      await loadProjectTags();
    } catch (error) {
      setProjectTagError(error.message || 'Unable to save project tag.');
    } finally {
      setIsSavingProjectTag(false);
    }
  }

  async function removeProjectTag(tag) {
    if (!window.confirm(`Delete project tag "${tag.name}"? Existing transactions will keep their data but lose this tag.`)) {
      return;
    }

    setProjectTagMessage('');
    setProjectTagError('');

    try {
      await deleteProjectTag(tag.id);
      await loadProjectTags();
      setProjectTagMessage('Project tag deleted.');
      if (projectTagForm.id === tag.id) {
        resetProjectTagForm();
      }
    } catch (error) {
      setProjectTagError(error.message || 'Unable to delete project tag.');
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
      setDraggingCategoryId('');
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
      setDraggingCategoryId('');
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
    setDraggingCategoryId('');
    resetCategoryForm();
  }

  function closeCategoryManager() {
    setSettingsView('settings');
    setSelectedParentId('');
    setCategoryMessage('');
    setCategoryError('');
    setPendingDeleteId('');
    setDraggingCategoryId('');
    resetCategoryForm();
  }

  function openParentCategory(category) {
    setSelectedParentId(category.id);
    setSettingsView('children');
    setPendingDeleteId('');
    setDraggingCategoryId('');
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

  function renderDeleteButton(category) {
    return (
      <button
        aria-label={pendingDeleteId === category.id ? `Hide delete for ${category.name}` : `Show delete for ${category.name}`}
        className="category-minus-button"
        onClick={(event) => {
          event.stopPropagation();
          setPendingDeleteId((current) => (current === category.id ? '' : category.id));
        }}
        type="button"
      >
        <FlatIcon name="minus" />
      </button>
    );
  }

  function reorderCategoryPreview(activeId, overId, rows) {
    if (!activeId || !overId || activeId === overId) {
      return rows;
    }

    const nextRows = [...rows];
    const fromIndex = nextRows.findIndex((item) => item.id === activeId);
    const toIndex = nextRows.findIndex((item) => item.id === overId);

    if (fromIndex < 0 || toIndex < 0) {
      return rows;
    }

    const [moved] = nextRows.splice(fromIndex, 1);
    nextRows.splice(toIndex, 0, moved);

    setCategories((current) => current.map((category) => {
      const rowIndex = nextRows.findIndex((row) => row.id === category.id);
      return rowIndex >= 0 ? { ...category, sort_order: rowIndex + 1 } : category;
    }));

    return nextRows;
  }

  function startCategoryDrag(event, category, rows) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    event.preventDefault();
    setPendingDeleteId('');
    setDraggingCategoryId(category.id);
    dragCategoryIdRef.current = category.id;
    dragRowsRef.current = rows;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveCategoryDrag(event, category) {
    if (dragCategoryIdRef.current !== category.id) {
      return;
    }

    const targetRow = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('[data-category-row-id]');
    const overId = targetRow?.getAttribute('data-category-row-id');

    if (!overId) {
      return;
    }

    dragRowsRef.current = reorderCategoryPreview(category.id, overId, dragRowsRef.current);
  }

  async function endCategoryDrag(event, category) {
    if (dragCategoryIdRef.current !== category.id) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragCategoryIdRef.current = '';
    setDraggingCategoryId('');
    setCategoryMessage('');
    setCategoryError('');
    setIsSortingCategory(true);

    try {
      await updateCategoryOrder(dragRowsRef.current);
      await loadCategories();
    } catch (error) {
      setCategoryError(error.message);
      await loadCategories();
    } finally {
      dragRowsRef.current = [];
      dragCategoryIdRef.current = '';
      setIsSortingCategory(false);
    }
  }

  function cancelCategoryDrag(event, category) {
    if (dragCategoryIdRef.current !== category.id) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRowsRef.current = [];
    dragCategoryIdRef.current = '';
    setDraggingCategoryId('');
    loadCategories();
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
          <button
            aria-label={isChildView ? 'Add subcategory' : 'Add top category'}
            className="category-page-add-button"
            onClick={handleAddCategory}
            type="button"
          >
            <FlatIcon name="plus" />
          </button>
        </section>

        <section className="panel category-manager-panel">
          <div className="category-manager-title-row">
            <div className="category-title-lockup">
              <span className="settings-flat-icon category-title-icon"><FlatIcon name="categoryAdd" /></span>
              <div>
                <h2>{isChildView ? selectedParent.name : 'Add / remove categories'}</h2>
              </div>
            </div>

            <div className="category-header-tools">
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

          <div className="category-flat-list is-editing">
            {rows.length === 0 && (
              <p className="muted-copy category-empty-copy">No categories yet.</p>
            )}

            {rows.map((category) => {
              const children = childrenByParentId.get(category.id) || [];
              const preview = children.map((child) => child.name).join(', ');

              const rowClassName = [
                'category-flat-row',
                pendingDeleteId === category.id ? 'reveal-delete' : '',
                draggingCategoryId === category.id ? 'is-dragging' : ''
              ].filter(Boolean).join(' ');

              return (
                <div
                  className={rowClassName}
                  data-category-row-id={category.id}
                  key={category.id}
                >
                  <div className="category-row-slide">
                    {renderDeleteButton(category)}
                    <div className="category-row-main">
                      <strong>{isChildView ? category.name : getCategoryLabel(category)}</strong>
                      {!isChildView && showSubcategories && preview && <small>{preview}</small>}
                    </div>
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
                        aria-label={`Reorder ${category.name}`}
                        className="category-icon-button category-drag-handle"
                        disabled={isSortingCategory}
                        onPointerCancel={(event) => cancelCategoryDrag(event, category)}
                        onPointerDown={(event) => startCategoryDrag(event, category, rows)}
                        onPointerMove={(event) => moveCategoryDrag(event, category)}
                        onPointerUp={(event) => endCategoryDrag(event, category)}
                        type="button"
                      >
                        <FlatIcon name="grip" />
                      </button>
                    </div>
                  </div>
                  <button
                    aria-label={`Delete ${category.name}`}
                    className="category-delete-reveal"
                    onClick={() => removeCategory(category)}
                    type="button"
                  >
                    <FlatIcon name="trash" />
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
      setDeleteError('Type "CONFIRM DELETE" to continue.');
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
          <label className="field-group">
            Default transaction source
            <select
              disabled={isSavingDefaultAccount}
              onChange={handleDefaultAccountChange}
              value={currentProfile?.default_account_id || ''}
            >
              <option value="">No default account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </label>
          <p className="muted-copy">Used when manual entries, OCR receipts, or statement imports do not already provide a source account.</p>
          {defaultAccountError && <p className="form-message error compact-message">{defaultAccountError}</p>}
          {defaultAccountMessage && <p className="form-message success compact-message">{defaultAccountMessage}</p>}
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
            <span className="settings-flat-icon"><FlatIcon name="tag" /></span>
            <h2>Project Tags</h2>
          </div>
          <p className="muted-copy">Create and rename project labels used in transactions, receipts, imports, and reports.</p>
          <form className="project-tag-form" onSubmit={saveProjectTag}>
            <label className="field-group">
              Tag name
              <input
                onChange={(event) => setProjectTagForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Daily Life"
                value={projectTagForm.name}
              />
            </label>
            <div className="button-row compact">
              <button className="primary-button small-action" disabled={isSavingProjectTag} type="submit">
                {projectTagForm.id ? 'Save Tag' : 'Add Tag'}
              </button>
              {projectTagForm.id && (
                <button className="secondary-button small-action" disabled={isSavingProjectTag} onClick={resetProjectTagForm} type="button">
                  Cancel
                </button>
              )}
            </div>
          </form>
          {projectTagError && <p className="form-message error compact-message">{projectTagError}</p>}
          {projectTagMessage && <p className="form-message success compact-message">{projectTagMessage}</p>}
          <div className="project-tag-list">
            {projectTags.length === 0 && <p className="muted-copy category-empty-copy">No project tags yet.</p>}
            {projectTags.map((tag) => (
              <div className="project-tag-row" key={tag.id}>
                <span>{tag.name}</span>
                <div className="project-tag-actions">
                  <button aria-label={`Edit ${tag.name}`} className="category-icon-button" onClick={() => editProjectTag(tag)} type="button">
                    <FlatIcon name="edit" />
                  </button>
                  <button aria-label={`Delete ${tag.name}`} className="category-icon-button danger" onClick={() => removeProjectTag(tag)} type="button">
                    <FlatIcon name="trash" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="settings-panel-title">
            <span className="settings-flat-icon"><FlatIcon name="info" /></span>
            <h2>About</h2>
          </div>
          <p className="muted-copy">Jejak Saku is a smart journal for expense records, receipt history, reports, and analysis.</p>
          <p className="about-version-line">
            <strong>Version:</strong> Jejak Saku {appVersion}
          </p>
          <div className="version-history">
            <h3>Version history</h3>
            {versionHistory.map((release) => (
              <details className="version-history-entry" key={release.version}>
                <summary>
                  <strong>{release.version}</strong>
                  <span>{release.title}</span>
                </summary>
                <ul>
                  {release.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </article>

        <article className="panel settings-panel-wide">
          <div className="danger-zone standalone">
            <div>
              <h3>Delete Account</h3>
              <p>
                This permanently removes your Jejak Saku account, profile, accounts, categories,
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
                    className="delete-confirmation-input"
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

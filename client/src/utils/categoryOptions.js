export function getCategoryOptions(categories = [], type = 'expense') {
  const filteredCategories = categories.filter((category) => !type || category.type === type);
  const byParentId = new Map();
  const parents = [];

  filteredCategories.forEach((category) => {
    if (category.parent_category_id) {
      const siblings = byParentId.get(category.parent_category_id) || [];
      siblings.push(category);
      byParentId.set(category.parent_category_id, siblings);
      return;
    }

    parents.push(category);
  });

  parents.sort(compareCategoryName);
  byParentId.forEach((children) => children.sort(compareCategoryName));

  return parents.flatMap((parent) => [
    {
      ...parent,
      displayName: parent.name,
      isParent: true
    },
    ...(byParentId.get(parent.id) || []).map((child) => ({
      ...child,
      displayName: `${parent.name} / ${child.name}`,
      parentName: parent.name,
      isParent: false
    }))
  ]);
}

export function getParentCategoryOptions(categories = [], type = 'expense') {
  return categories
    .filter((category) => category.type === type && !category.parent_category_id)
    .sort(compareCategoryName);
}

function compareCategoryName(a, b) {
  return a.name.localeCompare(b.name);
}

export const updateFavoriteOrBookmarkProperty = (recipes, favorite_recipes, bookmarked_recipes) => {
    return recipes.map(recipe => {
        recipe.is_favorite = favorite_recipes.includes(recipe._id);
        recipe.is_bookmarked = bookmarked_recipes.includes(recipe._id);
        return recipe
    })
}

export const getRecipeTitlesFromMealPlans = (mealPlans) => {
    return Array.from(new Set(mealPlans.flatMap(plan => plan.plan_data)
        .flatMap(item => item.get('meals')).map(item => item.title)));
};

export const getIngredientIds = (ingredients) => {
    return ingredients.map(ingredient => ingredient._id);
};

export const getSortingFilters = (filter, sortOrder) => {
    let sort = {};
    switch (filter) {
        case "Rating":
            sort = {
                average_rating: sortOrder === "asc" ? 1 : -1,
            };
            break;
        case "Cook Time":
            sort = {
                cook_time: sortOrder === "asc" ? 1 : -1,
            };
            break;
        case "Prep Time":
            sort = {
                prep_time: sortOrder === "asc" ? 1 : -1,
            };
            break;
        default:
            sort = {
                publish_date: sortOrder === "asc" ? 1 : -1,
            };
            break;
    }
    return sort;
};

export function roundToNearestHalf(value) {
    return Math.ceil(value * 2) / 2;
}
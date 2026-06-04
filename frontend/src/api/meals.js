import client from './client'

const get   = (url)       => client.get(url).then(r => r.data)
const post  = (url, body) => client.post(url, body).then(r => r.data)
const patch = (url, body) => client.patch(url, body).then(r => r.data)
const del   = (url)       => client.delete(url).then(r => r.data)

export const mealsApi = {
  // saved meal templates
  listMeals:   ()           => get('/meals/'),
  createMeal:  (data)       => post('/meals/', data),
  updateMeal:  (id, data)   => patch(`/meals/${id}`, data),
  deleteMeal:  (id)         => del(`/meals/${id}`),

  // recipes
  listRecipes:   ()         => get('/meals/recipes/'),
  getRecipe:     (id)       => get(`/meals/recipes/${id}`),
  createRecipe:  (data)     => post('/meals/recipes/', data),
  updateRecipe:  (id, data) => patch(`/meals/recipes/${id}`, data),
  deleteRecipe:  (id)       => del(`/meals/recipes/${id}`),
  importRecipe:  (url)      => post('/meals/recipes/import', { url }),

  // meal plan (scheduled)
  listPlan:    ()           => get('/meals/plan/'),
  createPlan:  (data)       => post('/meals/plan/', data),
  updatePlan:  (id, data)   => patch(`/meals/plan/${id}`, data),
  deletePlan:  (id)         => del(`/meals/plan/${id}`),
}

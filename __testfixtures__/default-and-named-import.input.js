import { createModules, middleware } from 'redux-modules'

export const { name, actions, reducer, constants, selector } = createModule({
  name: 'budget',
  initialState: fromJS({
    params: {
      size: 10000,
      page: 0,
      groupBy: DEFAULT_GROUPING,
    },
    _loading: false,
  }),
  selector: budgetModuleSelector,
  transformations: [
    {
      type: 'groupByInit',
      reducer: setParamsGroupByReducer,
    },
    {
      type: 'FETCH',
      middleware: [
        middleware.propCheck({
          id: oneOfType([string, number]),
        }),
      ],
      reducer: (state, { payload: { id } }) => {
        return state.update(id, Map(), budget => budget.set('_loading', true))
      },
    },
  ],
})

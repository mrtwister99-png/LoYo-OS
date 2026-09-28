# 02_WORKFLOW.md: Jak pracuješ

### Krok 1: Načti vstupy
- readFile PRD + domain use-cases + data repo interfaces
- Pokud máš design system v core/ui, použij ho, jinak vytvoř

### Krok 2: Design System :core:ui
- Theme.kt: MaterialTheme colorScheme dynamic, dark/light, typography
- Type.kt: Typography M3
- Components: AppButton, AppCard, AppTextField, AppTopBar - stateless, @Composable, preview
- Shape, Dimens

### Krok 3: Feature UI - MVI
- Pro každý feature: UiState data class (immutable), Intent sealed interface, Effect sealed interface (one-shot: Navigate, ShowSnackbar)
- ViewModel: class ExpensesViewModel(private val getExpenses: GetExpensesUseCase): ViewModel() { private val _state = MutableStateFlow(UiState()); val state: StateFlow = _state; fun onIntent(intent) }
- Používej viewModelScope, StateFlow, SharedFlow pro Effect
- Správné Dispatchers: use-cases už mají IO, VM jen Main

### Krok 4: Screen - stateless
- @Composable fun ExpensesScreen(state: UiState, onIntent: (Intent)->Unit, modifier)
- State hoisting: Screen dostává state + lambda, ne ViewModel přímo (kromě wrapperu)
- LazyColumn s keys, remember, derivedStateOf, LaunchedEffect jen když potřeba
- Modifier.testTag pro QA

### Krok 5: Navigation type-safe
- @Serializable data object ExpensesRoute, data class DetailRoute(val id: String)
- NavGraph: composable<ExpensesRoute> { backStackEntry -> ... }
- Hilt/ Koin nav: koinViewModel()

### Krok 6: Preview + zápis
- @Preview @Composable fun PreviewExpensesScreen() { AppTheme { ExpensesScreen(state=fakeData, onIntent={}) } }
- writeFile do feature/*/presentation/ a core/ui/
- Potvrzení: "✓ UI hotovo: 3 screens, MVI, M3, type-safe nav, previews → feature/"

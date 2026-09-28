# 03_GUARDRAILS.md: Železná pravidla

## Zákon č. 1: Zákaz stateful composables bez hoistingu
- Každá Screen composable musí být stateless: fun Screen(state, onIntent). Žádné viewModel() přímo v Screen, jen ve wrapperu ScreenRoute.
- ViewModel nesmí znát Compose.

## Zákon č. 2: Zákaz recomposition hell
- Žádné heavy work v @Composable těle. Používej remember, derivedStateOf, LaunchedEffect správně.
- Příklad špatně: `val filtered = items.filter { ... }` přímo v composable bez remember.
- Správně: `val filtered by remember(items) { derivedStateOf { items.filter } }`

## Zákon č. 3: Zákaz unstable params
- Všechny state data class musí být @Immutable nebo @Stable. Žádné List bez immutable wrapper nebo @Immutable.
- LazyColumn vždy s key: `items(items, key={it.id.value})`

## Zákon č. 4: Zákaz chybějících testTag
- Každý interaktivní prvek musí mít Modifier.testTag pro QA. Bez tagu = MAJOR od Reviewera.

## Zákon č. 5: Zákaz přímého Android frameworku ve ViewModelu
- ViewModel nesmí importovat Context, Intent, Activity. Jen use-cases + StateFlow. Navigation přes Effect.

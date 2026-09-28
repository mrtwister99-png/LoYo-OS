# 02_WORKFLOW.md: Jak pracuješ

### Krok 1: Načti zdrojáky
- listFiles core/domain/src, core/data/src, feature/*/src
- readFile domain use-cases, viewModels

### Krok 2: Domain unit testy - nejdůležitější
- Pro každý use-case: Given-When-Then, MockK mockk<Repository>(), coEvery { repo.getAll() } returns flowOf(list)
- Turbine: useCase().test { assertEquals(expected, awaitItem()); awaitComplete() }
- TestDispatcher: StandardTestDispatcher, runTest

### Krok 3: Data testy
- FakeDao, FakeApi, FakeDataStore
- RepositoryImpl test: ověř že čte z DAO a volá API na pozadí
- Test error mapping: NetworkException -> DomainError.Network

### Krok 4: ViewModel + MVI testy
- viewModel.state.test { assert initial loading, send Intent.Load, awaitItem loaded }
- Test Intent handling, Effect emission

### Krok 5: Compose UI testy
- @get:Rule val composeTestRule = createComposeRule()
- composeTestRule.setContent { AppTheme { ExpensesScreen(state, onIntent) } }
- onNodeWithTag("expenses_list").assertIsDisplayed(), onNodeWithText("Add").performClick()
- Modifier.testTag přidáváš do UI souborů pokud chybí

### Krok 6: Detekt + Ktlint + coverage
- config/detekt/detekt.yml: complexity, coroutines, compose, naming, style
- .editorconfig: kotlin { ktlint_standard = enabled }
- Vytvoř všechny test soubory přes writeFile
- Potvrzení: "✓ QA hotovo: 15 unit testů, 5 UI testů, detekt config, 80%+ domain coverage"

# 02_WORKFLOW.md: Jak pracuješ

### Krok 1: Načti domain interfaces
- readFile z core/domain/repository/ - musí existovat, jinak chyba
- readFile docs/ARCHITECTURE.md pro tech volby (Room vs SQLDelight)

### Krok 2: Room
- Vytvoř Entity: @Entity, @PrimaryKey, @ColumnInfo
- DAO: @Dao, @Query s Flow, @Insert(onConflict=REPLACE), @Transaction
- Database: @Database, @TypeConverters, RoomDatabase, KSP
- Migrations: 1 -> 2

### Krok 3: Ktor
- KtorClient: HttpClient(CIO) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys=true }) }; install(Logging); install(HttpTimeout); install(Retry) }
- Api interface + impl: suspend fun getExpenses(): List<ExpenseDto>
- DTOs: @Serializable data class s @SerialName
- Auth: Bearer token z DataStore

### Krok 4: RepositoryImpl + offline-first
- Impl třída: constructor(private val dao, private val api, private val prefs)
- getAll(): Flow = dao.observeAll().map { it.toDomain() } + na pozadí: try { api.getAll().map { it.toEntity() } -> dao.upsert() } catch -> log
- Mapper soubory: toDomain(), toDto(), toEntity() jako extension funkce

### Krok 5: DataStore + DI
- PreferencesDataSource: DataStore<Preferences>, Flow
- di/DataModule.kt: Koin module { single { AppDatabase }, single { dao }, single { KtorClient }, single<ExpenseRepository> { ExpenseRepositoryImpl(get(), get(), get()) } }

### Krok 6: Zápis
- writeFile do core/data/...
- Potvrzení: "✓ Data layer hotovo: Room + Ktor + DataStore + offline-first → core/data/"

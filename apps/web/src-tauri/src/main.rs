use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

// Fallback na hardcoded cestu pokud env není nastavena (dev bez .env)
fn data_root() -> String {
    std::env::var("LOYO_DATA_DIR")
        .or_else(|_| std::env::var("CARGO_MANIFEST_DIR").map(|m| format!("{}/../../../data", m)))
        .unwrap_or_else(|_| "./data".to_string())
}

fn resolve_data_path(input: &str) -> PathBuf {
    let p = Path::new(input);
    if p.is_absolute() {
        p.to_path_buf()
    } else {
        // KONVENCE v3 - relativní cesty se joinují s DATA_DIR
        PathBuf::from(data_root()).join(p)
    }
}

fn agents_base()    -> String { format!("{}/capabilities/agents",    data_root()) }
fn skills_base()    -> String { format!("{}/capabilities/skills",    data_root()) }
fn mcp_base()       -> String { format!("{}/capabilities/mcp",       data_root()) }
fn loops_base()     -> String { format!("{}/capabilities/loops",     data_root()) }
fn teams_base()     -> String { format!("{}/capabilities/teams",     data_root()) }
fn workflows_base() -> String { format!("{}/capabilities/workflows", data_root()) }

// ========== STRUCTS ==========
#[derive(Debug, Serialize, Deserialize, Clone)]
struct NoteFile {
    file_name: String,
    file_path: String,
    title: String,
    content: String,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TaskFile {
    file_name: String,
    file_path: String,
    title: String,
    content: String,
    done: bool,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TaskLiteFile {
    file_name: String,
    file_path: String,
    title: String,
    done: bool,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct EventFile {
    file_name: String,
    file_path: String,
    title: String,
    content: String,
    date: String,
    time: String,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AgentRecord {
    id: String,
    folder: String,
    name: String,
    role: String,
    #[serde(default)]
    category: String,
    #[serde(default)]
    team: String,
    #[serde(default = "default_online")]
    status: String,
    #[serde(default)]
    skills: Vec<String>,
    #[serde(default)]
    tools: Vec<String>,
    #[serde(default)]
    workflow: String,
    // prompt_file nahrazuje starý "prompt"
    #[serde(default, alias = "prompt")]
    prompt_file: String,
    #[serde(default)]
    docs: Vec<String>,
    #[serde(default)]
    tasks_today: u32,
    #[serde(default)]
    created: String,
    // last_run může být null (Koštěrad) nebo chybět
    #[serde(default, deserialize_with = "deserialize_nullable_string")]
    last_run: String,
}

fn default_online() -> String { "online".to_string() }

fn deserialize_nullable_string<'de, D>(d: D) -> Result<String, D::Error>
where D: serde::Deserializer<'de>
{
    let opt: Option<String> = Option::deserialize(d)?;
    Ok(opt.unwrap_or_default())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentIndex {
    version: String,
    last_sync: String,
    agents: Vec<AgentRecord>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SkillRecord {
    id: String,
    name: String,
    desc: String,
    folder: String,
    file: String,
    category: String,
    status: String,
    version: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillIndex {
    version: String,
    last_sync: String,
    skills: Vec<SkillRecord>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct McpRecord {
    id: String,
    name: String,
    command: String,
    status: String,
    tools: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpIndex {
    version: String,
    last_sync: String,
    tools: Vec<McpRecord>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LoopRecord {
    id: String,
    name: String,
    desc: String,
    status: String,
    schedule: String,
    agent: String,
    enabled: bool,
    category: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoopIndex {
    version: String,
    last_sync: String,
    loops: Vec<LoopRecord>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TeamRecord {
    id: String,
    name: String,
    desc: String,
    color: String,
    status: String,
    purpose: String,
    agents: Vec<String>,
    rag_files: Vec<String>,
    can_collaborate_with: Vec<String>,
    workflows: Vec<String>,
    loops: Vec<String>,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TeamIndex {
    version: String,
    last_sync: String,
    teams: Vec<TeamRecord>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WorkflowStepRecord {
    #[serde(rename = "type")]
    step_type: String,
    id: String,
    name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct WorkflowRecord {
    id: String,
    name: String,
    desc: String,
    status: String,
    steps: Vec<WorkflowStepRecord>,
    last_run: String,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkflowIndex {
    version: String,
    last_sync: String,
    workflows: Vec<WorkflowRecord>,
}

// ========== NOTES COMMANDS ==========
#[tauri::command]
fn save_note(path: String, content: String) -> Result<String, String> {
    let resolved = resolve_data_path(&path);
    if let Some(parent) = resolved.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&resolved, content).map_err(|e| e.to_string())?;
    Ok(resolved.to_string_lossy().to_string().replace('\\', "/"))
}

#[tauri::command]
fn list_notes(dir: String) -> Result<Vec<NoteFile>, String> {
    let resolved = resolve_data_path(&dir);
    let path = resolved.as_path();
    if !path.exists() {
        fs::create_dir_all(path).map_err(|e| e.to_string())?;
        return Ok(vec![]);
    }
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let mut notes = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if p.is_file() {
            if let Some(ext) = p.extension() {
                if ext == "md" || ext == "txt" {
                    if let Ok(content) = fs::read_to_string(&p) {
                        let title = content.lines().next().unwrap_or("Bez nazvu").trim_start_matches('#').trim().to_string();
                        let file_name = p.file_name().unwrap().to_string_lossy().to_string();
                        let file_path = p.to_string_lossy().to_string().replace('\\', "/");
                        let created_at = fs::metadata(&p).and_then(|m| m.modified()).map(|t| {
                            let dt: chrono::DateTime<chrono::Local> = t.into();
                            dt.format("%d.%m.%Y %H:%M").to_string()
                        }).unwrap_or_else(|_| chrono::Local::now().format("%d.%m.%Y").to_string());
                        notes.push(NoteFile { file_name, file_path, title: if title.is_empty() { "Bez nazvu".into() } else { title }, content: content.clone(), created_at });
                    }
                }
            }
        }
    }
    notes.sort_by(|a, b| b.file_name.cmp(&a.file_name));
    Ok(notes)
}

#[tauri::command]
fn read_note(path: String) -> Result<String, String> { fs::read_to_string(resolve_data_path(&path)).map_err(|e| e.to_string()) }

#[tauri::command]
fn delete_note(path: String) -> Result<(), String> { fs::remove_file(resolve_data_path(&path)).map_err(|e| e.to_string()) }

#[tauri::command]
fn ensure_dir(path: String) -> Result<String, String> { let resolved = resolve_data_path(&path); fs::create_dir_all(&resolved).map_err(|e| e.to_string())?; Ok(resolved.to_string_lossy().to_string().replace('\\', "/")) }

// ========== TASKS COMMANDS ==========
#[tauri::command]
fn list_tasks(dir: String) -> Result<Vec<TaskFile>, String> {
    let resolved = resolve_data_path(&dir);
    let path = resolved.as_path();
    if !path.exists() {
        fs::create_dir_all(path).map_err(|e| e.to_string())?;
        return Ok(vec![]);
    }
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let mut tasks = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if p.is_file() {
            if let Some(ext) = p.extension() {
                if ext == "md" || ext == "txt" {
                    if let Ok(content) = fs::read_to_string(&p) {
                        let title = content.lines().next().unwrap_or("Bez nazvu").trim_start_matches('#').trim().to_string();
                        let done = content.lines().find(|l| l.contains("**Hotovo:**")).map(|l| l.to_lowercase().contains("true")).unwrap_or(false);
                        let file_name = p.file_name().unwrap().to_string_lossy().to_string();
                        let file_path = p.to_string_lossy().to_string().replace('\\', "/");
                        let created_at = fs::metadata(&p).and_then(|m| m.modified()).map(|t| {
                            let dt: chrono::DateTime<chrono::Local> = t.into();
                            dt.format("%d.%m.%Y %H:%M").to_string()
                        }).unwrap_or_else(|_| chrono::Local::now().format("%d.%m.%Y").to_string());
                        tasks.push(TaskFile { file_name, file_path, title: if title.is_empty() { "Bez nazvu".into() } else { title }, content: content.clone(), done, created_at });
                    }
                }
            }
        }
    }
    tasks.sort_by(|a, b| b.file_name.cmp(&a.file_name));
    Ok(tasks)
}

#[tauri::command]
fn list_tasks_multi(dirs: Vec<String>) -> Result<Vec<TaskFile>, String> {
    let mut all_tasks = Vec::new();
    for dir in dirs {
        let resolved = resolve_data_path(&dir);
        let path = resolved.as_path();
        if !path.exists() { continue; }
        let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let p = entry.path();
            if p.is_file() {
                if let Some(ext) = p.extension() {
                    if ext == "md" || ext == "txt" {
                        if let Ok(content) = fs::read_to_string(&p) {
                            let title = content.lines().next().unwrap_or("Bez nazvu").trim_start_matches('#').trim().to_string();
                            let done = content.lines().find(|l| l.contains("**Hotovo:**")).map(|l| l.to_lowercase().contains("true")).unwrap_or(false);
                            let file_name = p.file_name().unwrap().to_string_lossy().to_string();
                            let file_path = p.to_string_lossy().to_string().replace('\\', "/");
                            let created_at = fs::metadata(&p).and_then(|m| m.modified()).map(|t| {
                                let dt: chrono::DateTime<chrono::Local> = t.into();
                                dt.format("%d.%m.%Y %H:%M").to_string()
                            }).unwrap_or_else(|_| chrono::Local::now().format("%d.%m.%Y").to_string());
                            all_tasks.push(TaskFile { file_name, file_path, title: if title.is_empty() { "Bez nazvu".into() } else { title }, content: content.clone(), done, created_at });
                        }
                    }
                }
            }
        }
    }
    all_tasks.sort_by(|a, b| b.file_name.cmp(&a.file_name));
    Ok(all_tasks)
}

#[tauri::command]
fn list_tasks_lite(dirs: Vec<String>) -> Result<Vec<TaskLiteFile>, String> {
    let mut all = Vec::new();
    for dir in dirs {
        let resolved = resolve_data_path(&dir);
        let path = resolved.as_path();
        if!path.exists() { continue; }
        let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let p = entry.path();
            if p.is_file() {
                if let Some(ext) = p.extension() {
                    if ext == "md" || ext == "txt" {
                        if let Ok(content) = fs::read_to_string(&p) {
                            let title = content.lines().next().unwrap_or("Bez nazvu").trim_start_matches('#').trim().to_string();
                            let done = content.lines().find(|l| l.contains("**Hotovo:**")).map(|l| l.to_lowercase().contains("true")).unwrap_or(false);
                            let file_name = p.file_name().unwrap().to_string_lossy().to_string();
                            let file_path = p.to_string_lossy().to_string().replace('\\', "/");
                            let created_at = fs::metadata(&p).and_then(|m| m.modified()).map(|t| {
                                let dt: chrono::DateTime<chrono::Local> = t.into();
                                dt.format("%d.%m.%Y %H:%M").to_string()
                            }).unwrap_or_else(|_| chrono::Local::now().format("%d.%m.%Y").to_string());
                            all.push(TaskLiteFile { file_name, file_path, title: if title.is_empty() { "Bez nazvu".into() } else { title }, done, created_at });
                        }
                    }
                }
            }
        }
    }
    all.sort_by(|a, b| b.file_name.cmp(&a.file_name));
    Ok(all)
}

#[tauri::command]
fn save_task(path: String, content: String) -> Result<String, String> {
    let resolved = resolve_data_path(&path);
    if let Some(parent) = resolved.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&resolved, content).map_err(|e| e.to_string())?;
    Ok(resolved.to_string_lossy().to_string().replace('\\', "/"))
}

#[tauri::command]
fn delete_task(path: String) -> Result<(), String> { fs::remove_file(resolve_data_path(&path)).map_err(|e| e.to_string()) }

// ========== CALENDAR EVENTS COMMANDS ==========
#[tauri::command]
fn list_events(dir: String) -> Result<Vec<EventFile>, String> {
    let resolved = resolve_data_path(&dir);
    let path = resolved.as_path();
    if !path.exists() {
        fs::create_dir_all(path).map_err(|e| e.to_string())?;
        return Ok(vec![]);
    }
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let mut events = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if p.is_file() {
            if let Some(ext) = p.extension() {
                if ext == "md" || ext == "txt" {
                    if let Ok(content) = fs::read_to_string(&p) {
                        let title = content.lines().next().unwrap_or("Bez nazvu").trim_start_matches('#').trim().to_string();
                        let date = content.lines().find(|l| l.contains("**Datum:**")).map(|l| l.split("**Datum:**").nth(1).unwrap_or("").trim().to_string()).unwrap_or_default();
                        let time = content.lines().find(|l| l.contains("**Čas:**")).map(|l| l.split("**Čas:**").nth(1).unwrap_or("").trim().to_string()).unwrap_or_default();
                        let file_name = p.file_name().unwrap().to_string_lossy().to_string();
                        let file_path = p.to_string_lossy().to_string().replace('\\', "/");
                        let created_at = fs::metadata(&p).and_then(|m| m.modified()).map(|t| {
                            let dt: chrono::DateTime<chrono::Local> = t.into();
                            dt.format("%d.%m.%Y %H:%M").to_string()
                        }).unwrap_or_else(|_| chrono::Local::now().format("%d.%m.%Y").to_string());
                        events.push(EventFile { file_name, file_path, title: if title.is_empty() { "Bez nazvu".into() } else { title }, content: content.clone(), date, time, created_at });
                    }
                }
            }
        }
    }
    events.sort_by(|a, b| a.date.cmp(&b.date).then(a.time.cmp(&b.time)));
    Ok(events)
}

#[tauri::command]
fn save_event(path: String, content: String) -> Result<String, String> {
    let resolved = resolve_data_path(&path);
    if let Some(parent) = resolved.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&resolved, content).map_err(|e| e.to_string())?;
    Ok(resolved.to_string_lossy().to_string().replace('\\', "/"))
}

#[tauri::command]
fn delete_event(path: String) -> Result<(), String> { fs::remove_file(resolve_data_path(&path)).map_err(|e| e.to_string()) }

// ========== AGENTS COMMANDS ==========
fn get_base_path() -> PathBuf { PathBuf::from(agents_base()) }

fn parse_identity_file(path: &Path) -> (Option<String>, Option<String>) {
    if !path.exists() { return (None, None); }
    let content = fs::read_to_string(path).unwrap_or_default();
    let name = content.lines().find(|l| l.contains("**Jméno:**")).map(|l| l.split("**Jméno:**").nth(1).unwrap_or("").trim().to_string());
    let role = content.lines().find(|l| l.contains("**Role:**")).map(|l| l.split("**Role:**").nth(1).unwrap_or("").trim().to_string());
    (name, role)
}

#[tauri::command]
fn sync_agents_from_fs() -> Result<AgentIndex, String> {
    let base_path = get_base_path();
    fs::create_dir_all(&base_path).map_err(|e| e.to_string())?;
    let index_path = base_path.join("index.json");
    let existing_map: HashMap<String, AgentRecord> = if index_path.exists() {
        fs::read_to_string(&index_path).ok().and_then(|c| serde_json::from_str::<AgentIndex>(&c).ok()).map(|idx| idx.agents.into_iter().map(|a| (a.id.clone(), a)).collect()).unwrap_or_default()
    } else { HashMap::new() };
    let mut agents = Vec::new();
    if let Ok(entries) = fs::read_dir(&base_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() { continue; }
            let folder_name = path.file_name().unwrap().to_string_lossy().to_string();
            if folder_name.starts_with('.') || folder_name == "index.json" { continue; }
            let mut docs = Vec::new();
            if let Ok(doc_entries) = fs::read_dir(&path) {
                for d in doc_entries.flatten() {
                    let p = d.path();
                    let fname = d.file_name().to_string_lossy().to_string();
                    if p.is_file() {
                        if p.extension().map_or(false, |ext| ext == "md") ||!fname.contains('.') { docs.push(fname); }
                    }
                }
            }
            docs.sort();
            let (parsed_name, parsed_role) = parse_identity_file(&path.join("01_CORE_IDENTITY.md"));
            let (parsed_name2, parsed_role2) = if parsed_name.is_none() { parse_identity_file(&path.join("01_CORE_IDENTITY")) } else { (None, None) };
            let final_name = parsed_name.or(parsed_name2);
            let final_role = parsed_role.or(parsed_role2);
            let id = folder_name.to_lowercase().replace(' ', "-").replace('_', "-");
            if let Some(existing) = existing_map.get(&id) {
                agents.push(AgentRecord {
                    id: existing.id.clone(), folder: folder_name.clone(),
                    name: final_name.unwrap_or_else(|| existing.name.clone()),
                    role: final_role.unwrap_or_else(|| existing.role.clone()),
                    category: existing.category.clone(), team: existing.team.clone(),
                    status: existing.status.clone(), skills: existing.skills.clone(),
                    tools: existing.tools.clone(), workflow: existing.workflow.clone(),
                    prompt_file: existing.prompt_file.clone(), docs, tasks_today: existing.tasks_today, created: existing.created.clone(),
                    last_run: existing.last_run.clone(),
                });
            } else {
                agents.push(AgentRecord {
                    id, folder: folder_name.clone(),
                    name: final_name.unwrap_or(folder_name.clone()),
                    role: final_role.unwrap_or_else(|| "Bez role".to_string()),
                    category: "all".into(), team: "LOYO OS v2".into(), status: "online".into(),
                    skills: vec![], tools: vec!["rag".into()], workflow: String::new(), prompt_file: String::new(),
                    docs, tasks_today: 0, created: chrono::Utc::now().to_rfc3339(),
                    last_run: String::new(),
                });
            }
        }
    }
    agents.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(AgentIndex { version: "2.0".into(), last_sync: chrono::Utc::now().to_rfc3339(), agents })
}

#[tauri::command]
fn save_agent_to_fs(agent: AgentRecord) -> Result<(), String> {
    let base_path = get_base_path().join(&agent.folder);
    fs::create_dir_all(&base_path).map_err(|e| e.to_string())?;
    let identity_content = format!(
        "# CORE IDENTITY\n\n**Jméno:** {}\n**Role:** {}\n**Team:** {}\n**Status:** {}\n\n## Prompt File\n{}\n\n## Workflow\n{}\n",
        agent.name, agent.role, agent.team, agent.status, agent.prompt_file, agent.workflow
    );
    fs::write(base_path.join("01_CORE_IDENTITY.md"), identity_content).map_err(|e| e.to_string())?;
    let index_path = get_base_path().join("index.json");
    let mut index: AgentIndex = if index_path.exists() {
        let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(AgentIndex { version: "2.0".into(), last_sync: String::new(), agents: vec![] })
    } else { AgentIndex { version: "2.0".into(), last_sync: String::new(), agents: vec![] } };
    if let Some(existing) = index.agents.iter_mut().find(|a| a.id == agent.id) { *existing = agent; } else { index.agents.push(agent); }
    index.last_sync = chrono::Utc::now().to_rfc3339();
    fs::write(&index_path, serde_json::to_string_pretty(&index).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_agent_from_fs(agent_id: String, folder: String) -> Result<(), String> {
    let target_folder = if!folder.is_empty() { folder } else { agent_id.clone() };
    let base_path = get_base_path().join(&target_folder);
    if base_path.exists() { fs::remove_dir_all(&base_path).map_err(|e| e.to_string())?; }
    let index_path = get_base_path().join("index.json");
    if index_path.exists() {
        let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        let mut index: AgentIndex = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        index.agents.retain(|a| a.id!= agent_id);
        index.last_sync = chrono::Utc::now().to_rfc3339();
        fs::write(&index_path, serde_json::to_string_pretty(&index).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ========== SKILLS COMMANDS ==========
fn get_skills_base() -> PathBuf { PathBuf::from(skills_base()) }

#[tauri::command]
fn sync_skills_from_fs() -> Result<SkillIndex, String> {
    let base = get_skills_base();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let index_path = base.join("index.json");
    if index_path.exists() {
        let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        let idx: SkillIndex = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        return Ok(idx);
    }
    Ok(SkillIndex { version: "2.0".into(), last_sync: chrono::Utc::now().to_rfc3339(), skills: vec![] })
}

#[tauri::command]
fn save_skill_to_fs(skill: SkillRecord) -> Result<(), String> {
    let base = get_skills_base();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let index_path = base.join("index.json");
    let mut idx = if index_path.exists() {
        let c = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&c).unwrap_or(SkillIndex { version: "2.0".into(), last_sync: String::new(), skills: vec![] })
    } else { SkillIndex { version: "2.0".into(), last_sync: String::new(), skills: vec![] } };
    if let Some(ex) = idx.skills.iter_mut().find(|s| s.id == skill.id) { *ex = skill.clone(); } else { idx.skills.push(skill.clone()); }
    idx.last_sync = chrono::Utc::now().to_rfc3339();
    fs::write(&index_path, serde_json::to_string_pretty(&idx).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::create_dir_all(base.join(&skill.folder)).ok();
    Ok(())
}

// ========== MCP COMMANDS ==========
fn get_mcp_base() -> PathBuf { PathBuf::from(mcp_base()) }

#[tauri::command]
fn sync_mcp_from_fs() -> Result<McpIndex, String> {
    let base = get_mcp_base();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let index_path = base.join("index.json");
    if index_path.exists() {
        let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        let idx: McpIndex = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        return Ok(idx);
    }
    Ok(McpIndex { version: "2.0".into(), last_sync: chrono::Utc::now().to_rfc3339(), tools: vec![] })
}

#[tauri::command]
fn save_mcp_to_fs(tool: McpRecord) -> Result<(), String> {
    let base = get_mcp_base();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let index_path = base.join("index.json");
    let mut idx = if index_path.exists() {
        let c = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&c).unwrap_or(McpIndex { version: "2.0".into(), last_sync: String::new(), tools: vec![] })
    } else { McpIndex { version: "2.0".into(), last_sync: String::new(), tools: vec![] } };
    if let Some(ex) = idx.tools.iter_mut().find(|t| t.id == tool.id) { *ex = tool; } else { idx.tools.push(tool); }
    idx.last_sync = chrono::Utc::now().to_rfc3339();
    fs::write(&index_path, serde_json::to_string_pretty(&idx).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(())
}

// ========== LOOPS COMMANDS ==========
fn get_loops_base() -> PathBuf { PathBuf::from(loops_base()) }

#[tauri::command]
fn sync_loops_from_fs() -> Result<LoopIndex, String> {
    let base = get_loops_base();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let index_path = base.join("index.json");
    if index_path.exists() {
        let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        let idx: LoopIndex = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        return Ok(idx);
    }
    Ok(LoopIndex { version: "2.0".into(), last_sync: chrono::Utc::now().to_rfc3339(), loops: vec![] })
}

#[tauri::command]
fn save_loop_to_fs(loop_item: LoopRecord) -> Result<(), String> {
    let base = get_loops_base();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let index_path = base.join("index.json");
    let mut idx = if index_path.exists() {
        let c = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&c).unwrap_or(LoopIndex { version: "2.0".into(), last_sync: String::new(), loops: vec![] })
    } else { LoopIndex { version: "2.0".into(), last_sync: String::new(), loops: vec![] } };
    if let Some(ex) = idx.loops.iter_mut().find(|l| l.id == loop_item.id) { *ex = loop_item; } else { idx.loops.push(loop_item); }
    idx.last_sync = chrono::Utc::now().to_rfc3339();
    fs::write(&index_path, serde_json::to_string_pretty(&idx).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(())
}

// ========== TEAMS COMMANDS ==========
fn get_teams_base() -> PathBuf { PathBuf::from(teams_base()) }

#[tauri::command]
fn sync_teams_from_fs() -> Result<TeamIndex, String> {
    let base = get_teams_base();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let index_path = base.join("index.json");
    if index_path.exists() {
        let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        let idx: TeamIndex = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        return Ok(idx);
    }
    Ok(TeamIndex { version: "2.0".into(), last_sync: chrono::Utc::now().to_rfc3339(), teams: vec![] })
}

#[tauri::command]
fn save_team_to_fs(team: TeamRecord) -> Result<(), String> {
    let base = get_teams_base();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let index_path = base.join("index.json");
    let mut idx = if index_path.exists() {
        let c = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&c).unwrap_or(TeamIndex { version: "2.0".into(), last_sync: String::new(), teams: vec![] })
    } else { TeamIndex { version: "2.0".into(), last_sync: String::new(), teams: vec![] } };
    if let Some(ex) = idx.teams.iter_mut().find(|t| t.id == team.id) { *ex = team.clone(); } else { idx.teams.push(team.clone()); }
    idx.last_sync = chrono::Utc::now().to_rfc3339();
    fs::write(&index_path, serde_json::to_string_pretty(&idx).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::create_dir_all(base.join(&team.id)).ok();
    Ok(())
}

#[tauri::command]
fn delete_team_from_fs(team_id: String) -> Result<(), String> {
    let base = get_teams_base();
    let index_path = base.join("index.json");
    if index_path.exists() {
        let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        let mut idx: TeamIndex = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        idx.teams.retain(|t| t.id!= team_id);
        idx.last_sync = chrono::Utc::now().to_rfc3339();
        fs::write(&index_path, serde_json::to_string_pretty(&idx).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    }
    let team_folder = base.join(&team_id);
    if team_folder.exists() { fs::remove_dir_all(team_folder).ok(); }
    Ok(())
}

// ========== WORKFLOWS COMMANDS ==========
fn get_workflows_base() -> PathBuf { PathBuf::from(workflows_base()) }

#[tauri::command]
fn sync_workflows_from_fs() -> Result<WorkflowIndex, String> {
    let base = get_workflows_base();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let index_path = base.join("index.json");
    if index_path.exists() {
        let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        let idx: WorkflowIndex = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        return Ok(idx);
    }
    Ok(WorkflowIndex { version: "2.0".into(), last_sync: chrono::Utc::now().to_rfc3339(), workflows: vec![] })
}

#[tauri::command]
fn save_workflow_to_fs(workflow: WorkflowRecord) -> Result<(), String> {
    let base = get_workflows_base();
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let index_path = base.join("index.json");
    let mut idx = if index_path.exists() {
        let c = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&c).unwrap_or(WorkflowIndex { version: "2.0".into(), last_sync: String::new(), workflows: vec![] })
    } else { WorkflowIndex { version: "2.0".into(), last_sync: String::new(), workflows: vec![] } };
    if let Some(ex) = idx.workflows.iter_mut().find(|w| w.id == workflow.id) { *ex = workflow.clone(); } else { idx.workflows.push(workflow.clone()); }
    idx.last_sync = chrono::Utc::now().to_rfc3339();
    fs::write(&index_path, serde_json::to_string_pretty(&idx).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_workflow_from_fs(workflow_id: String) -> Result<(), String> {
    let base = get_workflows_base();
    let index_path = base.join("index.json");
    if index_path.exists() {
        let content = fs::read_to_string(&index_path).map_err(|e| e.to_string())?;
        let mut idx: WorkflowIndex = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        idx.workflows.retain(|w| w.id!= workflow_id);
        idx.last_sync = chrono::Utc::now().to_rfc3339();
        fs::write(&index_path, serde_json::to_string_pretty(&idx).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ========== MAIN ==========
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            save_note, list_notes, read_note, delete_note, ensure_dir,
            list_tasks, list_tasks_multi, list_tasks_lite, save_task, delete_task,
            list_events, save_event, delete_event,
            sync_agents_from_fs, save_agent_to_fs, delete_agent_from_fs,
            sync_skills_from_fs, save_skill_to_fs,
            sync_mcp_from_fs, save_mcp_to_fs,
            sync_loops_from_fs, save_loop_to_fs,
            sync_teams_from_fs, save_team_to_fs, delete_team_from_fs,
            sync_workflows_from_fs, save_workflow_to_fs, delete_workflow_from_fs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
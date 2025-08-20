use serde::{Deserialize, Serialize};
use sysinfo::{Components, Disks, Networks, System};

#[derive(Serialize, Deserialize, Debug)]
pub struct SystemInfo {
    os_info: OsInfo,
    cpu_info: CpuInfo,
    memory_info: MemoryInfo,
    disk_info: Vec<DiskInfo>,
    network_info: Vec<NetworkInfo>,
    component_info: Vec<ComponentInfo>,
}

#[derive(Serialize, Deserialize, Debug)]
struct OsInfo {
    os_type: String,
    os_version: String,
    hostname: String,
    uptime: u64,
}

#[derive(Serialize, Deserialize, Debug)]
struct CpuInfo {
    brand: String,
    frequency: u64,
    cores: usize,
}

#[derive(Serialize, Deserialize, Debug)]
struct MemoryInfo {
    total_memory: u64,
    used_memory: u64,
    total_swap: u64,
    used_swap: u64,
}

#[derive(Serialize, Deserialize, Debug)]
struct DiskInfo {
    name: String,
    file_system: String,
    total_space: u64,
    available_space: u64,
}

#[derive(Serialize, Deserialize, Debug)]
struct NetworkInfo {
    interface_name: String,
    mac_address: String,
    received: u64,
    transmitted: u64,
}

#[derive(Serialize, Deserialize, Debug)]
struct ComponentInfo {
    label: String,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    let mut sys = System::new_all();

    let os_info = OsInfo {
        os_type: System::name().unwrap_or_else(|| "N/A".to_string()),
        os_version: System::os_version().unwrap_or_else(|| "N/A".to_string()),
        hostname: System::host_name().unwrap_or_else(|| "N/A".to_string()),
        uptime: System::uptime(),
    };

    let cpu_info = CpuInfo {
        brand: sys.cpus()[0].brand().to_string(),
        frequency: sys.cpus()[0].frequency(),
        cores: sys.cpus().len(),
    };

    let memory_info = MemoryInfo {
        total_memory: sys.total_memory(),
        used_memory: sys.used_memory(),
        total_swap: sys.total_swap(),
        used_swap: sys.used_swap(),
    };

    let disks = Disks::new_with_refreshed_list();
    let disk_info: Vec<DiskInfo> = disks
        .iter()
        .map(|disk| DiskInfo {
            name: disk.name().to_string_lossy().into_owned(),
            file_system: disk.file_system().to_string_lossy().into_owned(),
            total_space: disk.total_space(),
            available_space: disk.available_space(),
        })
        .collect();

    let networks = Networks::new_with_refreshed_list();
    let network_info: Vec<NetworkInfo> = networks
        .iter()
        .map(|(interface_name, data)| NetworkInfo {
            interface_name: interface_name.clone(),
            mac_address: data.mac_address().to_string(),
            received: data.received(),
            transmitted: data.transmitted(),
        })
        .collect();

    let components = Components::new_with_refreshed_list();
    let component_info: Vec<ComponentInfo> = components
        .iter()
        .map(|component| ComponentInfo {
            label: component.label().to_string(),
        })
        .collect();

    Ok(SystemInfo {
        os_info,
        cpu_info,
        memory_info,
        disk_info,
        network_info,
        component_info,
    })
}
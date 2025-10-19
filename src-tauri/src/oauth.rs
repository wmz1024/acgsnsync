use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::Manager;
use tiny_http::{Header, Response, Server};
use url::Url;

static LOGIN_IN_PROGRESS: AtomicBool = AtomicBool::new(false);
static AUTH_CODE: Lazy<Arc<Mutex<Option<String>>>> = Lazy::new(|| Arc::new(Mutex::new(None)));

#[derive(Serialize, Deserialize, Clone)]
struct OAuthConfig {
    skin_url: String,
    client_id: String,
    client_secret: String,
    redirect_uri: String,
}

static OAUTH_CONFIG: Lazy<OAuthConfig> = Lazy::new(|| OAuthConfig {
    skin_url: "https://id.jb.wiki".to_string(), // 请替换为您的皮肤站地址
    client_id: "4".to_string(),      // 请替换为您的 Client ID
    client_secret: "2ssVHQryuUsLsKBv52dyQoj9CX7hnYH8EyDPSdxP".to_string(), // 请替换为您的 Client Secret
    redirect_uri: "http://localhost:13522/callback".to_string(),
});

#[derive(Serialize, Deserialize, Debug)]
struct TokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UserInfo {
    pub uid: i32,
    pub nickname: String,
    // 您可以根据需要添加更多字段
    // pub email: String,
    // pub score: i32,
    // pub permission: String,
}

pub fn setup_oauth_server() {
    std::thread::spawn(|| {
        let server = match Server::http("0.0.0.0:13522") {
            Ok(s) => s,
            Err(e) => {
                println!("[OAuth Server] Failed to start: {}", e);
                return;
            }
        };
        println!("[OAuth Server] Listening on http://0.0.0.0:13522");

        for request in server.incoming_requests() {
            println!("[OAuth Server] Received request: {}", request.url());
            if let Some(code) = get_code_from_url(request.url()) {
                println!("[OAuth Server] Extracted authorization code: {}", code);
                let mut auth_code = AUTH_CODE.lock().unwrap();
                *auth_code = Some(code);
                
                let success_html = std::fs::read_to_string("public/loginok.html")
                     .unwrap_or_else(|_| "<html><body><script>window.location.href = 'https://static.v0.net.cn/loginok.html' + window.location.search;</script></body></html>".to_string());
                let header = "Content-Type: text/html; charset=utf-8".parse::<Header>().unwrap();
                let response = Response::from_string(success_html).with_header(header);
                let _ = request.respond(response);
            } else {
                let error_html = "<html><body><h1>Authorization Failed</h1><p>No authorization code was found in the callback URL.</p></body></html>";
                let header = "Content-Type: text/html; charset=utf-8".parse::<Header>().unwrap();
                let response = Response::from_string(error_html).with_header(header);
                let _ = request.respond(response);
            }
        }
    });
}

#[tauri::command]
pub fn start_login(app: tauri::AppHandle) {
    if LOGIN_IN_PROGRESS.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        println!("[OAuth] Login process already in progress. Ignoring new request.");
        if let Some(window) = app.get_window("main") {
            let _ = window.set_focus();
        }
        return;
    }
    
    {
        let mut auth_code = AUTH_CODE.lock().unwrap();
        *auth_code = None;
    }

    println!("[OAuth] Starting login process...");
    let authorize_url = format!(
        "{}/oauth/authorize?client_id={}&redirect_uri={}&response_type=code&scope=",
        OAUTH_CONFIG.skin_url,
        OAUTH_CONFIG.client_id,
        OAUTH_CONFIG.redirect_uri
    );
    println!("[OAuth] Opening authorization URL: {}", authorize_url);
    tauri::api::shell::open(&app.shell_scope(), authorize_url, None).unwrap();

    let app_handle = app.app_handle();

    std::thread::spawn(move || {
        struct LoginGuard;
        impl Drop for LoginGuard {
            fn drop(&mut self) {
                LOGIN_IN_PROGRESS.store(false, Ordering::SeqCst);
                println!("[OAuth] Login process finished. Ready for new login.");
            }
        }
        let _guard = LoginGuard;
        
        let start_time = Instant::now();
        let timeout = Duration::from_secs(300);

        loop {
            if start_time.elapsed() > timeout {
                println!("[OAuth] Login timed out.");
                app_handle.emit_all("oauth_error", "Login timed out.").unwrap();
                break;
            }
            
            let code_option = {
                let mut auth_code_guard = AUTH_CODE.lock().unwrap();
                auth_code_guard.take()
            };

            if let Some(code) = code_option {
                println!("[OAuth] Polling successful, got code.");
                
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async {
                    match exchange_code_for_token(code).await {
                        Ok(token_response) => {
                            match get_user_info(&token_response.access_token).await {
                                Ok(user_info) => {
                                    let full_user_data = serde_json::json!({
                                        "token": token_response,
                                        "user": user_info
                                    });
                                    println!("[OAuth] Successfully retrieved user info: {:?}", full_user_data);
                                    app_handle.emit_all("oauth_success", &full_user_data).unwrap();
                                    
                                    if let Some(window) = app_handle.get_window("main") {
                                        let _ = window.set_focus();
                                    }
                                }
                                Err(e) => {
                                    let error_msg = format!("[OAuth] Failed to get user info: {}", e);
                                    println!("{}", error_msg);
                                    app_handle.emit_all("oauth_error", &error_msg).unwrap();
                                }
                            }
                        }
                        Err(e) => {
                            let error_msg = format!("[OAuth] Failed to exchange token: {}", e);
                            println!("{}", error_msg);
                            app_handle.emit_all("oauth_error", &error_msg).unwrap();
                        }
                    }
                });
                break;
            }

            std::thread::sleep(Duration::from_millis(500));
        }
    });
}

fn get_code_from_url(url: &str) -> Option<String> {
    if let Ok(parsed_url) = Url::parse(&("http://localhost".to_string() + url)) {
        for (key, value) in parsed_url.query_pairs() {
            if key == "code" {
                return Some(value.to_string());
            }
        }
    }
    None
}

#[tauri::command]
pub async fn validate_token(access_token: String) -> Result<UserInfo, String> {
    match get_user_info(&access_token).await {
        Ok(user_info) => Ok(user_info),
        Err(e) => Err(e.to_string()),
    }
}

pub async fn exchange_code_for_token(code: String) -> Result<TokenResponse, Box<dyn std::error::Error + Send + Sync>> {
    println!("[OAuth] Exchanging code for access token...");
    let client = reqwest::Client::new();
    let mut params = HashMap::new();
    params.insert("grant_type", "authorization_code");
    params.insert("client_id", &OAUTH_CONFIG.client_id);
    params.insert("client_secret", &OAUTH_CONFIG.client_secret);
    params.insert("redirect_uri", &OAUTH_CONFIG.redirect_uri);
    params.insert("code", &code);

    let response = client
        .post(format!("{}/oauth/token", OAUTH_CONFIG.skin_url))
        .form(&params)
        .send()
        .await?;

    let token_text = response.text().await?;
    println!("[OAuth] Token JSON response: {}", token_text);

    let token_response: TokenResponse = serde_json::from_str(&token_text)?;

    println!("[OAuth] Successfully received token response: {:?}", token_response);
    Ok(token_response)
}

pub async fn get_user_info(access_token: &str) -> Result<UserInfo, Box<dyn std::error::Error + Send + Sync>> {
    println!("[OAuth] Getting user info with access token...");
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/user", OAUTH_CONFIG.skin_url))
        .header("Authorization", format!("Bearer {}", access_token))
        .send()
        .await?;

    let user_info_text = response.text().await?;
    println!("[OAuth] User info JSON response: {}", user_info_text);

    let user_info: UserInfo = serde_json::from_str(&user_info_text)?;

    Ok(user_info)
}

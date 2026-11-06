// Prevents additional console window on Windows in all build profiles
#![windows_subsystem = "windows"]

fn main() {
    brotalk_lib::run();
}

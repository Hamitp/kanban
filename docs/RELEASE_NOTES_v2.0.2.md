# Akış v2.0.2 — Masaüstü v2 kayıt uyumluluğu

Bu bakım sürümü, masaüstü kayıt motorunun yeni çoklu çalışma alanı verisini kabul edip atomik olarak kaydetmesini sağlar.

- Eski `version: 1` kayıtları okunmaya devam eder ve kayıpsız biçimde dönüştürülür.
- Yeni `version: 2` çalışma alanı deposu Rust katmanında da derinlemesine doğrulanır.
- Aktif alanın var ve arşivlenmemiş olması kayıt öncesinde güvence altına alınır.
- v2 verisinin dosyaya yazılıp yeniden okunması bağımsız Rust testiyle doğrulanır.

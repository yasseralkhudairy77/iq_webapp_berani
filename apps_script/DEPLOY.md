# Deploy Ulang Apps Script (Web App)

## 1) Buat project Apps Script baru
1. Buka `script.new`.
2. Ganti isi `Code.gs` dengan file [Code.gs](/mnt/data/Users/user/Documents/iq_webapp_modern/apps_script/Code.gs).
3. Simpan.

## 2) Isi Spreadsheet ID
1. Buka file `Code.gs`.
2. Ubah:
   - `CONFIG.SPREADSHEET_ID = "PASTE_SPREADSHEET_ID_DI_SINI"`
3. Ambil ID dari URL Google Sheet:
   - `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

## 3) Deploy sebagai Web App
1. Klik `Deploy` -> `New deployment`.
2. Type: `Web app`.
3. Execute as: `Me`.
4. Who has access: `Anyone`.
5. Klik `Deploy`, lalu copy URL `/exec`.

## 4) Pasang URL baru ke aplikasi
Gunakan URL `/exec` tersebut sebagai endpoint di frontend.

Cara cepat (dari browser di halaman app):
```js
localStorage.setItem("berani_sheet_endpoint_v1","PASTE_URL_EXEC_DI_SINI");
location.reload();
```

Atau replace default URL di file berikut lalu refresh:
- [apps/iq/index.html](/mnt/data/Users/user/Documents/iq_webapp_modern/apps/iq/index.html)
- [apps/koran/index.html](/mnt/data/Users/user/Documents/iq_webapp_modern/apps/koran/index.html)
- [apps/typing/index.html](/mnt/data/Users/user/Documents/iq_webapp_modern/apps/typing/index.html)
- [apps/disc/index.html](/mnt/data/Users/user/Documents/iq_webapp_modern/apps/disc/index.html)
- [apps/working-style/index.html](/mnt/data/Users/user/Documents/iq_webapp_modern/apps/working-style/index.html)

## 5) Test end-to-end
1. Jalankan IQ test 1 kandidat sampai submit.
2. Cek sheet:
   - `NO_TOKEN` terisi/terupdate by `token`.
   - `IQ` append hasil tes.
3. Lanjut submit Pauli, Typing, DISC, Working Style.
4. Cek `MASTER_REPORT` terisi otomatis by token.

## Catatan
- `STRICT_TOKEN: false` artinya token baru boleh dibuat otomatis saat submit IQ.
- Jika mau token wajib sudah terdaftar dulu di `NO_TOKEN`, ubah jadi `STRICT_TOKEN: true`.

# How to add songs to Jalebi Jams (no coding)

Only add songs you own or have permission to share. This is a public website.

## Every time you want to add songs

1. **Make small files.** Each MP3 should be under 25 MB (a normal 3-5 minute song is fine).
2. **Name each file:** `Song Title - Artist Name.mp3`
3. **Pick the folder** that matches the song:
   - `music/songs/hindi/chatpatte/`  (Hindi party hits)
   - `music/songs/hindi/retro/`      (Hindi retro)
   - `music/songs/marathi/standard/` (Marathi)
4. On GitHub open your repo, open that folder, click **Add file → Upload files**, drag your MP3s in, and click **Commit changes**.
5. Wait about 2-3 minutes. A robot finds the hook of every song, updates `music/library.json`, and the site refreshes. Check the **Actions** tab: a green tick means done.

## If a song starts at the wrong place
Open `tools/hook-picker.html` on your computer, load the song, mark the hook start and end, and note the two numbers. Then in GitHub open `music/overrides.json`, click the pencil icon, and write:

```json
{
  "hindi/chatpatte/Song Title - Artist Name.mp3": { "hookStart": 52.5, "playbackEnd": 118 }
}
```
(Use a comma between several songs.) Commit, and the robot re-runs.

## To remove a song
Delete the MP3 from its folder on GitHub. The robot updates the playlist.

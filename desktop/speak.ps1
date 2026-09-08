param([string]$TextPath,[string]$OutputPath,[int]$Rate=0)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$auralithSpeech = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $auralithSpeech.Rate = $Rate
  $auralithFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(48000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $auralithSpeech.SetOutputToWaveFile($OutputPath, $auralithFormat)
  $auralithSpeech.Speak([System.IO.File]::ReadAllText($TextPath, [System.Text.Encoding]::UTF8))
} finally { $auralithSpeech.Dispose() }

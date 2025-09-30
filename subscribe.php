<?php
header('Content-Type: application/json');

// E-Mail-Validierung
function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = isset($_POST['email']) ? trim($_POST['email']) : '';

    if (empty($email)) {
        echo json_encode(['success' => false, 'message' => 'Keine E-Mail-Adresse angegeben.']);
        exit;
    }

    if (!validateEmail($email)) {
        echo json_encode(['success' => false, 'message' => 'Bitte gib eine gültige E-Mail-Adresse ein.']);
        exit;
    }

    // E-Mail in Datei speichern
    $file = 'emails.txt';
    $emailEntry = $email . ' - ' . date('Y-m-d H:i:s') . "\n";

    if (file_put_contents($file, $emailEntry, FILE_APPEND | LOCK_EX)) {
        echo json_encode(['success' => true, 'message' => 'Super! Wir haben dich eingetragen.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Server-Fehler. Bitte versuche es später erneut.']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Ungültige Anfrage.']);
}
?>
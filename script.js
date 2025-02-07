document.addEventListener("DOMContentLoaded", function() {
    const optionsModal = document.getElementById("optionsModal");
    const optionsButton = document.getElementById("optionsButton");
    const closeModal = document.getElementById("closeModal");

    // Asegurar que el modal esté oculto al cargar la página
    optionsModal.style.display = "none";

    optionsButton.addEventListener("click", function() {
        optionsModal.style.display = "flex";
    });

    closeModal.addEventListener("click", function() {
        optionsModal.style.display = "none";
    });
});

// Lógica para el buscador (Search Box)
export class SearchBox {
    private input: HTMLInputElement | null;
    private clearBtn: HTMLElement | null;

    constructor() {
        this.input = document.querySelector('.search-box input');
        this.clearBtn = document.getElementById('search-clear');

        if (this.input && this.clearBtn) {
            this.init();
        }
    }

    private init() {
        if (!this.input || !this.clearBtn) {return;}

        // Mostrar/ocultar botón 'x' según el contenido inicial
        this.updateClearButtonVisibility();

        // Escuchar cambios en el input
        this.input.addEventListener('input', () => {
            this.updateClearButtonVisibility();
        });

        // Borrar texto al clickear 'x'
        this.clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.input) {
                this.input.value = '';
                this.updateClearButtonVisibility();
                this.input.focus();
            }
        });
    }

    private updateClearButtonVisibility() {
        if (!this.input || !this.clearBtn) {return;}
        
        if (this.input.value.length > 0) {
            this.clearBtn.classList.add('visible');
        } else {
            this.clearBtn.classList.remove('visible');
        }
    }
}

// Inicializar de forma segura
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new SearchBox());
} else {
    new SearchBox();
}

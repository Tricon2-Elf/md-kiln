(function () {
  "use strict";

  var API_BASE = "/admin/api";

  var state = {
    root: null,
    siteName: "mdkiln",
    authenticated: false,
    username: "",
    csrf: "",
    tags: [],
    defaultTag: "news",
    kind: "post",
    items: [],
    navLinks: [],
    draft: null,
    mode: "rich",
    dirty: false,
    refs: {},
    editor: null,
    previewTimer: null,
  };

  // ---------------------------------------------------------------------------
  // Small DOM helpers
  // ---------------------------------------------------------------------------

  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value == null || value === false) return;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key === "html") node.innerHTML = value;
        else if (key === "dataset") {
          Object.keys(value).forEach(function (name) {
            node.dataset[name] = value[name];
          });
        } else if (key.slice(0, 2) === "on" && typeof value === "function") {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
          node.setAttribute(key, value === true ? "" : String(value));
        }
      });
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null || c === false) return;
        node.appendChild(
          typeof c === "string" || typeof c === "number"
            ? document.createTextNode(String(c))
            : c,
        );
      });
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function toast(message, type) {
    var host = document.querySelector(".toast-host");
    if (!host) {
      host = h("div", { class: "toast-host" });
      document.body.appendChild(host);
    }
    var el = h("div", {
      class: "toast" + (type ? " toast--" + type : ""),
      text: message,
    });
    host.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 3800);
  }

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------

  function api(method, path, body) {
    var options = { method: method, headers: {} };
    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    if (state.csrf && method !== "GET") {
      options.headers["X-CSRF-Token"] = state.csrf;
    }

    return fetch(API_BASE + path, options).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (!res.ok) {
            if (res.status === 401 && path !== "/login") {
              state.authenticated = false;
              renderLogin("Your session has expired. Please sign in again.");
            }
            var error = new Error(
              (data && data.error) || "Request failed (" + res.status + ")",
            );
            error.status = res.status;
            error.data = data;
            throw error;
          }
          return data;
        });
    });
  }

  function kindBase() {
    if (state.kind === "post") return "posts";
    if (state.kind === "page") return "pages";
    return "nav";
  }

  function todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  function slugify(value) {
    return String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120);
  }

  // ---------------------------------------------------------------------------
  // Login / boot
  // ---------------------------------------------------------------------------

  function boot() {
    state.root = document.getElementById("admin-root");
    if (!state.root) return;
    state.siteName = state.root.getAttribute("data-site-name") || "mdkiln";

    api("GET", "/session")
      .then(function (data) {
        if (!data.configured) {
          renderNotConfigured();
          return;
        }
        if (!data.authenticated) {
          renderLogin();
          return;
        }
        state.authenticated = true;
        state.username = data.username;
        state.csrf = data.csrfToken;
        startApp();
      })
      .catch(function (err) {
        renderFatal(err.message);
      });
  }

  function authScreen(card) {
    clear(state.root);
    state.root.appendChild(h("div", { class: "login" }, [card]));
  }

  function renderNotConfigured() {
    authScreen(
      h("div", { class: "login__card" }, [
        h("h1", { class: "login__title", text: "Admin not configured" }),
        h("p", {
          class: "login__subtitle",
          text: "Set the following environment variables and restart the server to enable the admin portal.",
        }),
        h("div", { class: "login__note" }, [
          h("div", [
            h("code", { text: "ADMIN_USERNAME" }),
            " — the login username",
          ]),
          h("div", [
            h("code", { text: "ADMIN_PASSWORD" }),
            " — the login password",
          ]),
          h("div", [
            h("code", { text: "ADMIN_SESSION_SECRET" }),
            " — optional, keeps sessions valid across restarts",
          ]),
        ]),
      ]),
    );
  }

  function renderFatal(message) {
    authScreen(
      h("div", { class: "login__card" }, [
        h("h1", { class: "login__title", text: "Something went wrong" }),
        h("p", { class: "login__subtitle", text: message }),
      ]),
    );
  }

  function renderLogin(message) {
    var errorBox = message
      ? h("div", { class: "login__error", text: message })
      : null;

    var username = h("input", {
      class: "field__input",
      type: "text",
      name: "username",
      autocomplete: "username",
      autofocus: true,
    });

    var password = h("input", {
      class: "field__input",
      type: "password",
      name: "password",
      autocomplete: "current-password",
    });

    var submit = h("button", {
      class: "btn btn--primary btn--block",
      type: "submit",
      text: "Sign in",
    });

    var form = h(
      "form",
      {
        class: "login__form",
        onsubmit: function (event) {
          event.preventDefault();
          submit.disabled = true;
          api("POST", "/login", {
            username: username.value,
            password: password.value,
          })
            .then(function (data) {
              state.authenticated = true;
              state.username = data.username;
              state.csrf = data.csrfToken;
              startApp();
            })
            .catch(function (err) {
              submit.disabled = false;
              var existing = form.querySelector(".login__error");
              if (existing) existing.remove();
              var box = h("div", { class: "login__error", text: err.message });
              form.insertBefore(box, form.firstChild);
              password.value = "";
              password.focus();
            });
        },
      },
      [
        errorBox,
        h("label", { class: "field" }, [
          h("span", { class: "field__label", text: "Username" }),
          username,
        ]),
        h("label", { class: "field" }, [
          h("span", { class: "field__label", text: "Password" }),
          password,
        ]),
        submit,
      ],
    );

    authScreen(
      h("div", { class: "login__card" }, [
        h("h1", { class: "login__title", text: state.siteName }),
        h("p", {
          class: "login__subtitle",
          text: "Sign in to manage content.",
        }),
        form,
      ]),
    );
  }

  // ---------------------------------------------------------------------------
  // App shell
  // ---------------------------------------------------------------------------

  function startApp() {
    api("GET", "/config")
      .then(function (config) {
        state.siteName = config.siteName || state.siteName;
        state.tags = config.tags || [];
        state.defaultTag = config.defaultTag || "news";
        renderApp();
        return loadList();
      })
      .catch(function (err) {
        toast(err.message, "error");
      });
  }

  function renderApp() {
    clear(state.root);

    var postTab = h("button", {
      class: "tab",
      text: "Posts",
      onclick: function () {
        selectKind("post");
      },
    });
    var pageTab = h("button", {
      class: "tab",
      text: "Pages",
      onclick: function () {
        selectKind("page");
      },
    });
    var navTab = h("button", {
      class: "tab",
      text: "Navigation",
      onclick: function () {
        selectKind("nav");
      },
    });

    var actionsEl = h("div", { class: "sidebar__actions" });
    var listEl = h("ul", { class: "sidebar__list" });

    var sidebar = h("aside", { class: "sidebar" }, [
      h("div", { class: "sidebar__tabs" }, [postTab, pageTab, navTab]),
      actionsEl,
      listEl,
    ]);

    var main = h("main", { class: "main" });

    var header = h("header", { class: "app-header" }, [
      h("div", { class: "app-header__brand" }, [
        h("span", { text: state.siteName }),
        h("span", { class: "app-header__badge", text: "Admin" }),
      ]),
      h("div", { class: "app-header__actions" }, [
        h("span", {
          class: "app-header__user",
          text: "Signed in as " + state.username,
        }),
        h("a", {
          class: "btn",
          href: "/",
          target: "_blank",
          rel: "noopener",
          text: "View site",
        }),
        h("button", {
          class: "btn",
          text: "Sign out",
          onclick: function () {
            api("POST", "/logout")
              .catch(function () {})
              .then(function () {
                state.authenticated = false;
                state.csrf = "";
                renderLogin();
              });
          },
        }),
      ]),
    ]);

    var app = h("div", { class: "app" }, [
      header,
      h("div", { class: "app-body" }, [sidebar, main]),
    ]);

    state.root.appendChild(app);

    state.refs = {
      postTab: postTab,
      pageTab: pageTab,
      navTab: navTab,
      actionsEl: actionsEl,
      listEl: listEl,
      main: main,
    };

    updateKindChrome();

    if (state.kind !== "nav") showEmptyState();
  }

  function updateKindChrome() {
    state.refs.postTab.classList.toggle("tab--active", state.kind === "post");
    state.refs.pageTab.classList.toggle("tab--active", state.kind === "page");
    state.refs.navTab.classList.toggle("tab--active", state.kind === "nav");
    renderSidebarActions();
  }

  function renderSidebarActions() {
    var host = state.refs.actionsEl;
    clear(host);

    if (state.kind === "nav") {
      host.appendChild(
        h("button", {
          class: "btn btn--primary btn--block",
          type: "button",
          text: "Add text link",
          onclick: function () {
            addNavLink("text");
          },
        }),
      );
      host.appendChild(
        h("button", {
          class: "btn btn--block",
          type: "button",
          text: "Add icon link",
          onclick: function () {
            addNavLink("icon");
          },
        }),
      );
      return;
    }

    host.appendChild(
      h("button", {
        class: "btn btn--primary btn--block",
        type: "button",
        text: state.kind === "post" ? "New post" : "New page",
        onclick: newItem,
      }),
    );
  }

  function showEmptyState() {
    var refs = state.refs;
    clear(refs.main);
    refs.main.appendChild(
      h("div", { class: "empty" }, [
        h("p", {
          class: "empty__title",
          text: state.kind === "post" ? "Posts" : "Pages",
        }),
        h("p", {
          text: "Select an item from the sidebar or create a new one.",
        }),
      ]),
    );
    state.editor = null;
    state.draft = null;
  }

  function confirmDiscard() {
    if (!state.dirty) return true;
    return window.confirm("You have unsaved changes. Discard them?");
  }

  function selectKind(kind) {
    if (state.kind === kind) return;
    if (!confirmDiscard()) return;
    state.kind = kind;
    state.dirty = false;
    state.editor = null;
    state.draft = null;
    updateKindChrome();
    if (kind !== "nav") showEmptyState();
    loadList();
  }

  function loadList() {
    if (state.kind === "nav") {
      return api("GET", "/nav")
        .then(function (data) {
          state.navLinks = (data.links || []).map(normalizeNavLink);
          renderList();
          renderNavEditor();
        })
        .catch(function (err) {
          toast(err.message, "error");
        });
    }

    return api("GET", "/" + kindBase())
      .then(function (data) {
        state.items = data.items || [];
        renderList();
      })
      .catch(function (err) {
        toast(err.message, "error");
      });
  }

  function renderList() {
    if (state.kind === "nav") {
      renderNavList();
      return;
    }

    var listEl = state.refs.listEl;
    clear(listEl);

    if (!state.items.length) {
      listEl.appendChild(
        h("li", {
          class: "sidebar__empty",
          text: state.kind === "post" ? "No posts yet." : "No pages yet.",
        }),
      );
      return;
    }

    state.items.forEach(function (item) {
      var active =
        state.draft && !state.draft.isNew && state.draft.slug === item.slug;
      var meta = [];

      if (item.tag) {
        var tag = state.tags.filter(function (t) {
          return t.key === item.tag;
        })[0];
        meta.push(
          h("span", {
            class: "item__dot",
            style: "--tag-color:" + ((tag && tag.color) || "steelblue"),
          }),
        );
        meta.push(h("span", { text: (tag && tag.label) || item.tag }));
      }
      if (item.date) meta.push(h("span", { text: item.date }));

      listEl.appendChild(
        h(
          "li",
          {},
          h(
            "button",
            {
              class: "item" + (active ? " item--active" : ""),
              type: "button",
              onclick: function () {
                openItem(item.slug);
              },
            },
            [
              h("div", { class: "item__title", text: item.title }),
              meta.length ? h("div", { class: "item__meta" }, meta) : null,
            ],
          ),
        ),
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Navigation (config.json → nav.links)
  // ---------------------------------------------------------------------------

  function normalizeNavLink(link) {
    return {
      type: link && link.type === "icon" ? "icon" : "text",
      label: (link && link.label) || "",
      href: (link && link.href) || "",
      icon: (link && link.icon) || "",
    };
  }

  function renderNavList() {
    var listEl = state.refs.listEl;
    clear(listEl);

    if (!state.navLinks.length) {
      listEl.appendChild(
        h("li", { class: "sidebar__empty", text: "No menu links yet." }),
      );
      return;
    }

    state.navLinks.forEach(function (link, index) {
      listEl.appendChild(
        h(
          "li",
          {},
          h(
            "button",
            {
              class: "item",
              type: "button",
              onclick: function () {
                focusNavRow(index);
              },
            },
            [
              h("div", {
                class: "item__title",
                text: link.label || "(no label)",
              }),
              h("div", { class: "item__meta" }, [
                h("span", { class: "item__dot" }),
                h("span", { text: link.type === "icon" ? "Icon" : "Text" }),
                link.href ? h("span", { text: link.href }) : null,
              ]),
            ],
          ),
        ),
      );
    });
  }

  function focusNavRow(index) {
    var row = document.getElementById("nav-row-" + index);
    if (!row) return;
    row.scrollIntoView({ block: "center" });
    var input = row.querySelector("input");
    if (input) input.focus();
  }

  function addNavLink(type) {
    state.navLinks.push({ type: type, label: "", href: "", icon: "" });
    markDirty();
    renderList();
    renderNavEditor();
    focusNavRow(state.navLinks.length - 1);
  }

  function moveNavLink(index, delta) {
    var target = index + delta;
    if (target < 0 || target >= state.navLinks.length) return;
    var link = state.navLinks.splice(index, 1)[0];
    state.navLinks.splice(target, 0, link);
    markDirty();
    renderList();
    renderNavEditor();
    focusNavRow(target);
  }

  function removeNavLink(index) {
    state.navLinks.splice(index, 1);
    markDirty();
    renderList();
    renderNavEditor();
  }

  function navRow(link, index) {
    var typeSelect = h(
      "select",
      {
        class: "field__select nav-row__type",
        onchange: function () {
          link.type = typeSelect.value;
          markDirty();
          renderNavEditor();
        },
      },
      [
        h("option", {
          value: "text",
          text: "Text",
          selected: link.type === "text",
        }),
        h("option", {
          value: "icon",
          text: "Icon",
          selected: link.type === "icon",
        }),
      ],
    );

    var labelInput = h("input", {
      class: "field__input",
      type: "text",
      value: link.label,
      placeholder: "Label",
      oninput: function () {
        link.label = labelInput.value;
        markDirty();
      },
    });

    var hrefInput = h("input", {
      class: "field__input",
      type: "text",
      value: link.href,
      placeholder: "/about or https://example.com",
      oninput: function () {
        link.href = hrefInput.value;
        markDirty();
      },
    });

    var fields = [field("Label", labelInput), field("Link", hrefInput)];

    if (link.type === "icon") {
      var preview = h("img", {
        class: "nav-icon-preview",
        alt: "",
        src: link.icon || "",
      });
      preview.hidden = !link.icon;

      var updatePreview = function () {
        preview.src = link.icon;
        preview.hidden = !link.icon;
      };

      var iconInput = h("input", {
        class: "field__input",
        type: "text",
        value: link.icon,
        placeholder: "/img/icon.svg or https://example.com/icon.svg",
        oninput: function () {
          link.icon = iconInput.value;
          markDirty();
          updatePreview();
        },
      });

      fields.push(
        wide(
          field(
            "Icon (SVG)",
            h("div", { class: "image-row" }, [
              iconInput,
              h("button", {
                class: "btn",
                type: "button",
                text: "Upload SVG",
                onclick: function () {
                  pickIcon().then(function (url) {
                    if (!url) return;
                    link.icon = url;
                    iconInput.value = url;
                    updatePreview();
                    markDirty();
                  });
                },
              }),
              preview,
            ]),
          ),
        ),
      );
    }

    var controls = h("div", { class: "nav-row__controls" }, [
      h("button", {
        class: "btn btn--ghost",
        type: "button",
        title: "Move up",
        text: "\u2191",
        disabled: index === 0,
        onclick: function () {
          moveNavLink(index, -1);
        },
      }),
      h("button", {
        class: "btn btn--ghost",
        type: "button",
        title: "Move down",
        text: "\u2193",
        disabled: index === state.navLinks.length - 1,
        onclick: function () {
          moveNavLink(index, 1);
        },
      }),
      h("button", {
        class: "btn btn--danger",
        type: "button",
        text: "Remove",
        onclick: function () {
          removeNavLink(index);
        },
      }),
    ]);

    return h("div", { class: "panel nav-row", id: "nav-row-" + index }, [
      h("div", { class: "nav-row__head" }, [
        h("span", { class: "nav-row__index", text: String(index + 1) }),
        typeSelect,
        controls,
      ]),
      h("div", { class: "meta-grid nav-row__fields" }, fields),
    ]);
  }

  function renderNavEditor() {
    var refs = state.refs;
    clear(refs.main);
    state.editor = null;
    state.draft = null;

    var rows = h("div", { class: "nav-rows" });
    if (state.navLinks.length) {
      state.navLinks.forEach(function (link, index) {
        rows.appendChild(navRow(link, index));
      });
    } else {
      rows.appendChild(
        h("p", {
          class: "field__hint",
          text: "No links yet. Use “Add text link” or “Add icon link” to create one.",
        }),
      );
    }

    var editor = h("section", { class: "editor" }, [
      h("div", { class: "editor__top" }, [
        h("h2", { class: "editor__heading", text: "Navigation menu" }),
        h("div", { class: "editor__actions" }, [
          h("button", {
            class: "btn btn--primary",
            type: "button",
            text: "Save navigation",
            onclick: saveNav,
          }),
        ]),
      ]),
      h("p", {
        class: "field__hint",
        text: "These links appear in the top bar. Text links show a label; icon links show an SVG from a local path or a remote URL. Saving updates config.json and rebuilds the site.",
      }),
      rows,
    ]);

    refs.main.appendChild(editor);
  }

  function saveNav() {
    var links = state.navLinks.map(function (link) {
      var out = {
        type: link.type,
        label: (link.label || "").trim(),
        href: (link.href || "").trim(),
      };
      if (link.type === "icon") out.icon = (link.icon || "").trim();
      return out;
    });

    for (var i = 0; i < links.length; i++) {
      if (!links[i].label) {
        toast("Link " + (i + 1) + ": a label is required.", "error");
        return;
      }
      if (!links[i].href) {
        toast("Link " + (i + 1) + ": a link URL is required.", "error");
        return;
      }
      if (links[i].type === "icon" && !links[i].icon) {
        toast("Link " + (i + 1) + ": an icon is required.", "error");
        return;
      }
    }

    api("PUT", "/nav", { links: links })
      .then(function (data) {
        state.navLinks = (data.links || []).map(normalizeNavLink);
        state.dirty = false;
        renderList();
        renderNavEditor();
        toast("Navigation saved.", "success");
      })
      .catch(function (err) {
        toast(err.message, "error");
      });
  }

  function pickIcon() {
    return pickFile("image/svg+xml,.svg");
  }

  // ---------------------------------------------------------------------------
  // Editor
  // ---------------------------------------------------------------------------

  function newItem() {
    if (!confirmDiscard()) return;
    state.dirty = false;
    state.mode = "rich";
    state.draft = {
      isNew: true,
      kind: state.kind,
      slug: "",
      title: "",
      date: state.kind === "post" ? todayIso() : "",
      tag: state.kind === "post" ? state.defaultTag : "",
      excerpt: "",
      image: "",
      markdown: "",
      html: "",
    };
    renderList();
    renderEditor();
  }

  function openItem(slug) {
    if (!confirmDiscard()) return;
    api("GET", "/" + kindBase() + "/" + encodeURIComponent(slug))
      .then(function (data) {
        state.dirty = false;
        state.mode = "rich";
        state.draft = {
          isNew: false,
          kind: state.kind,
          slug: data.item.slug,
          title: data.item.title,
          date: data.item.date,
          tag: data.item.tag,
          excerpt: data.item.excerpt,
          image: data.item.image,
          markdown: data.item.markdown,
          html: data.html || "",
        };
        renderList();
        renderEditor();
      })
      .catch(function (err) {
        toast(err.message, "error");
      });
  }

  function field(labelText, control) {
    return h("label", { class: "field" }, [
      h("span", { class: "field__label", text: labelText }),
      control,
    ]);
  }

  function renderEditor(focusTitle) {
    var draft = state.draft;
    var refs = state.refs;

    clear(refs.main);

    var titleInput = h("input", {
      class: "field__input",
      type: "text",
      value: draft.title,
      placeholder: state.kind === "post" ? "Post title" : "Page title",
      oninput: function () {
        draft.title = titleInput.value;
        if (draft.isNew && !slugTouched) {
          slugInput.value = slugify(titleInput.value);
          draft.slug = slugInput.value;
        }
        markDirty();
        updateHeading();
      },
    });

    var slugInput = h("input", {
      class: "field__input",
      type: "text",
      value: draft.slug,
      placeholder: "url-slug",
      readonly: !draft.isNew,
      oninput: function () {
        slugTouched = true;
        var clean = slugInput.value
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
        if (clean !== slugInput.value) slugInput.value = clean;
        draft.slug = clean;
        markDirty();
      },
    });
    var slugTouched = Boolean(draft.slug);

    var heading = h("h2", {
      class: "editor__heading",
      text: editorHeadingText(),
    });

    function updateHeading() {
      heading.textContent = editorHeadingText();
    }

    var metaFields = [wide(field("Title", titleInput))];

    if (state.kind === "post") {
      var dateInput = h("input", {
        class: "field__input",
        type: "date",
        value: draft.date,
        oninput: function () {
          draft.date = dateInput.value;
          markDirty();
        },
      });

      var tagSelect = h(
        "select",
        {
          class: "field__select",
          onchange: function () {
            draft.tag = tagSelect.value;
            markDirty();
          },
        },
        state.tags.map(function (tag) {
          return h("option", {
            value: tag.key,
            text: tag.label,
            selected: tag.key === draft.tag,
          });
        }),
      );

      metaFields.push(field("Slug", slugInput));
      metaFields.push(field("Date", dateInput));
      metaFields.push(field("Tag", tagSelect));

      var excerptInput = h("textarea", {
        class: "field__textarea",
        text: draft.excerpt,
        placeholder: "Short summary shown on the home page",
        oninput: function () {
          draft.excerpt = excerptInput.value;
          markDirty();
        },
      });
      metaFields.push(wide(field("Excerpt", excerptInput)));
    } else {
      metaFields.push(field("Slug", slugInput));
    }

    var imageInput = h("input", {
      class: "field__input",
      type: "text",
      value: draft.image,
      placeholder: "/uploads/cover.jpg or https://…",
      oninput: function () {
        draft.image = imageInput.value;
        markDirty();
      },
    });

    var imageRow = h("div", { class: "image-row" }, [
      imageInput,
      h("button", {
        class: "btn",
        type: "button",
        text: "Upload",
        onclick: function () {
          pickImage().then(function (url) {
            if (!url) return;
            imageInput.value = url;
            draft.image = url;
            markDirty();
          });
        },
      }),
    ]);
    metaFields.push(wide(field("Feature image", imageRow)));

    var metaPanel = h("div", { class: "panel meta-grid" }, metaFields);

    var actions = h("div", { class: "editor__actions" }, [
      h("button", {
        class: "btn",
        type: "button",
        text: "Back",
        onclick: function () {
          if (!confirmDiscard()) return;
          state.dirty = false;
          state.draft = null;
          showEmptyState();
          renderList();
        },
      }),
      draft.isNew
        ? null
        : h("button", {
            class: "btn btn--danger",
            type: "button",
            text: "Delete",
            onclick: deleteItem,
          }),
      h("button", {
        class: "btn btn--primary",
        type: "button",
        text: "Save",
        onclick: saveItem,
      }),
    ]);

    var richPane = buildRichPane();
    var markdownPane = buildMarkdownPane();

    var modeSwitch = h("div", { class: "mode-switch" }, [
      modeButton("Rich text", "rich"),
      modeButton("Markdown", "markdown"),
    ]);

    var editor = h("section", { class: "editor" }, [
      h("div", { class: "editor__top" }, [heading, actions]),
      metaPanel,
      h("div", { class: "editor__top" }, [
        modeSwitch,
        h("span", {
          class: "field__hint",
          text: "Tip: press Ctrl/Cmd + S to save.",
        }),
      ]),
      richPane,
      markdownPane,
    ]);

    refs.main.appendChild(editor);

    state.editor = {
      titleInput: titleInput,
      slugInput: slugInput,
      richPane: richPane,
      markdownPane: markdownPane,
      surface: richPane.querySelector(".surface"),
      source: markdownPane.querySelector(".source"),
      preview: markdownPane.querySelector(".preview"),
      modeButtons: modeSwitch.querySelectorAll(".mode-btn"),
    };

    // Seed the editing surfaces from the saved markdown.
    state.editor.surface.innerHTML = sanitizeEditorHtml(draft.html || "");
    state.editor.source.value = draft.markdown;
    renderPreview(draft.markdown);

    state.editor.surface.addEventListener("input", markDirty);
    state.editor.surface.addEventListener("paste", function (event) {
      event.preventDefault();
      var text = (event.clipboardData || window.clipboardData).getData(
        "text/plain",
      );
      document.execCommand("insertText", false, text);
    });
    state.editor.source.addEventListener("input", function () {
      markDirty();
      schedulePreview();
    });

    applyMode();
    if (focusTitle !== false) titleInput.focus();
  }

  function editorHeadingText() {
    if (!state.draft) return "";
    if (state.draft.isNew) {
      return state.kind === "post" ? "New post" : "New page";
    }
    return state.kind === "post" ? "Edit post" : "Edit page";
  }

  function wide(node) {
    node.classList.add("field--wide");
    return node;
  }

  function markDirty() {
    state.dirty = true;
  }

  function modeButton(label, mode) {
    return h("button", {
      class: "mode-btn",
      type: "button",
      text: label,
      onclick: function () {
        setMode(mode);
      },
    });
  }

  function buildRichPane() {
    var toolbar = h("div", { class: "toolbar" });
    [
      ["B", "bold", "Bold"],
      ["I", "italic", "Italic"],
      ["S", "strikeThrough", "Strikethrough"],
      null,
      ["H1", "formatBlock:<h1>", "Heading 1"],
      ["H2", "formatBlock:<h2>", "Heading 2"],
      ["H3", "formatBlock:<h3>", "Heading 3"],
      ["¶", "formatBlock:<p>", "Paragraph"],
      null,
      ["• List", "insertUnorderedList", "Bulleted list"],
      ["1. List", "insertOrderedList", "Numbered list"],
      ["❝", "formatBlock:<blockquote>", "Quote"],
      ["</>", "formatBlock:<pre>", "Code block"],
      null,
      ["Link", "createLink", "Insert link"],
      ["Image", "insertImage", "Insert image"],
      ["—", "insertHorizontalRule", "Horizontal rule"],
      ["Clear", "removeFormat", "Clear formatting"],
    ].forEach(function (entry) {
      if (!entry) {
        toolbar.appendChild(h("span", { class: "toolbar__sep" }));
        return;
      }
      toolbar.appendChild(
        h("button", {
          class: "tool-btn",
          type: "button",
          title: entry[2],
          text: entry[0],
          onmousedown: function (event) {
            event.preventDefault();
          },
          onclick: function () {
            runCommand(entry[1]);
          },
        }),
      );
    });

    var surface = h("div", {
      class: "surface",
      contenteditable: "true",
      spellcheck: "true",
    });

    return h("div", { class: "rich-pane" }, [toolbar, surface]);
  }

  function runCommand(command) {
    var surface = state.editor.surface;
    surface.focus();

    if (command === "createLink") {
      var url = window.prompt("Link URL:", "https://");
      if (!url) return;
      var selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        document.execCommand(
          "insertHTML",
          false,
          '<a href="' + url + '">' + url + "</a>",
        );
      } else {
        document.execCommand("createLink", false, url);
      }
    } else if (command === "insertImage") {
      insertImageFromPicker();
      return;
    } else if (command.indexOf("formatBlock:") === 0) {
      document.execCommand("formatBlock", false, command.slice(12));
    } else {
      document.execCommand(command, false, null);
    }

    markDirty();
    updateToolbarState();
  }

  function updateToolbarState() {
    if (!state.editor) return;
    var buttons = state.editor.richPane.querySelectorAll(".tool-btn");
    Array.prototype.forEach.call(buttons, function (button) {
      var title = button.getAttribute("title");
      var command = null;
      if (title === "Bold") command = "bold";
      else if (title === "Italic") command = "italic";
      else if (title === "Strikethrough") command = "strikeThrough";
      else if (title === "Bulleted list") command = "insertUnorderedList";
      else if (title === "Numbered list") command = "insertOrderedList";
      if (!command) return;
      try {
        button.classList.toggle(
          "tool-btn--active",
          document.queryCommandState(command),
        );
      } catch (err) {
        /* queryCommandState can throw in some browsers */
      }
    });
  }

  function buildMarkdownPane() {
    var source = h("textarea", {
      class: "source",
      spellcheck: "false",
      placeholder: "Write Markdown here…",
    });
    var preview = h("div", { class: "preview" });
    return h("div", { class: "markdown-pane editor-split" }, [
      h("div", { class: "editor-pane" }, [
        h("span", { class: "editor-pane__label", text: "Markdown" }),
        source,
      ]),
      h("div", { class: "editor-pane" }, [
        h("span", { class: "editor-pane__label", text: "Preview" }),
        preview,
      ]),
    ]);
  }

  function setMode(mode) {
    if (!state.editor || state.mode === mode) {
      applyMode();
      return;
    }

    if (mode === "markdown") {
      var md = serializeSurface(state.editor.surface);
      state.draft.markdown = md;
      state.editor.source.value = md;
      renderPreview(md);
    } else {
      var source = state.editor.source.value;
      state.draft.markdown = source;
      markDirty();
      renderMarkdown(source).then(function (html) {
        if (state.editor)
          state.editor.surface.innerHTML = sanitizeEditorHtml(html);
      });
    }

    state.mode = mode;
    applyMode();
  }

  function applyMode() {
    if (!state.editor) return;
    var rich = state.mode === "rich";
    state.editor.richPane.hidden = !rich;
    state.editor.markdownPane.hidden = rich;
    Array.prototype.forEach.call(state.editor.modeButtons, function (button) {
      var isRich = button.textContent === "Rich text";
      button.classList.toggle(
        "mode-btn--active",
        (rich && isRich) || (!rich && !isRich),
      );
    });
  }

  function renderMarkdown(markdown) {
    return api("POST", "/preview", { markdown: markdown }).then(
      function (data) {
        return data.html || "";
      },
    );
  }

  /**
   * The editor surface and preview are populated from HTML rendered by the
   * server. Strip scripts (and inline event handlers / javascript: URLs) so a
   * stored `<script>` in content can't execute or trip the page's CSP.
   */
  function sanitizeEditorHtml(html) {
    if (!html) return "";
    var template = document.createElement("template");
    template.innerHTML = html;

    var scripts = template.content.querySelectorAll("script");
    for (var i = 0; i < scripts.length; i++) {
      scripts[i].remove();
    }

    var nodes = template.content.querySelectorAll("*");
    for (var j = 0; j < nodes.length; j++) {
      var attributes = nodes[j].attributes;
      for (var k = attributes.length - 1; k >= 0; k--) {
        var attribute = attributes[k];
        if (/^on/i.test(attribute.name)) {
          nodes[j].removeAttribute(attribute.name);
        } else if (
          (attribute.name === "href" || attribute.name === "src") &&
          /^\s*javascript:/i.test(attribute.value)
        ) {
          nodes[j].removeAttribute(attribute.name);
        }
      }
    }

    return template.innerHTML;
  }

  function renderPreview(markdown) {
    if (!state.editor) return;
    var target = state.editor.preview;
    if (!markdown || !markdown.trim()) {
      target.innerHTML = "";
      return;
    }
    renderMarkdown(markdown)
      .then(function (html) {
        if (state.editor && state.editor.preview === target) {
          target.innerHTML = sanitizeEditorHtml(html);
        }
      })
      .catch(function () {
        /* ignore preview errors */
      });
  }

  function schedulePreview() {
    clearTimeout(state.previewTimer);
    state.previewTimer = setTimeout(function () {
      if (state.editor && state.mode === "markdown") {
        renderPreview(state.editor.source.value);
      }
    }, 250);
  }

  function syncDraftFromEditor() {
    if (!state.editor) return;
    if (state.mode === "markdown") {
      state.draft.markdown = state.editor.source.value;
    } else {
      state.draft.markdown = serializeSurface(state.editor.surface);
    }
  }

  function saveItem() {
    var draft = state.draft;
    if (!draft) return;
    syncDraftFromEditor();

    var title = (draft.title || "").trim();
    if (!title) {
      toast("A title is required.", "error");
      return;
    }

    var slug = (draft.slug || "").trim() || slugify(title);
    if (!/^[a-z0-9-]+$/i.test(slug)) {
      toast("Slug may only contain letters, numbers, and hyphens.", "error");
      return;
    }

    var payload = {
      title: title,
      date: draft.date,
      tag: draft.tag,
      excerpt: draft.excerpt,
      image: draft.image,
      markdown: draft.markdown,
    };
    var query = draft.isNew ? "?create=true" : "";

    api(
      "PUT",
      "/" + kindBase() + "/" + encodeURIComponent(slug) + query,
      payload,
    )
      .then(function (res) {
        draft.isNew = false;
        draft.slug = res.slug;
        if (state.editor && state.mode === "rich") {
          draft.html = state.editor.surface.innerHTML;
        }
        state.dirty = false;
        toast("Saved.", "success");
        return loadList().then(function () {
          if (state.draft === draft) renderEditor(false);
        });
      })
      .catch(function (err) {
        toast(err.message, "error");
        if (err.status === 409) {
          var override = window.confirm(
            "An item with this slug already exists. Overwrite it?",
          );
          if (override && state.draft) {
            state.draft.isNew = false;
            saveItem();
          }
        }
      });
  }

  function deleteItem() {
    var draft = state.draft;
    if (!draft || draft.isNew) return;
    if (
      !window.confirm(
        'Delete "' + (draft.title || draft.slug) + '"? This cannot be undone.',
      )
    ) {
      return;
    }

    api("DELETE", "/" + kindBase() + "/" + encodeURIComponent(draft.slug))
      .then(function () {
        toast("Deleted.", "success");
        state.dirty = false;
        state.draft = null;
        showEmptyState();
        return loadList();
      })
      .catch(function (err) {
        toast(err.message, "error");
      });
  }

  // ---------------------------------------------------------------------------
  // Image upload
  // ---------------------------------------------------------------------------

  function pickFile(accept) {
    return new Promise(function (resolve) {
      var input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        if (!file) {
          resolve(null);
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          api("POST", "/upload", {
            filename: file.name,
            dataUrl: String(reader.result),
          })
            .then(function (res) {
              if (res.deduplicated) {
                toast(
                  "Identical file already uploaded — reused it.",
                  "success",
                );
              }
              resolve(res.url);
            })
            .catch(function (err) {
              toast(err.message, "error");
              resolve(null);
            });
        };
        reader.onerror = function () {
          toast("Could not read that file.", "error");
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
      input.click();
    });
  }

  function pickImage() {
    return pickFile("image/*");
  }

  function saveSelection() {
    var selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    return selection.getRangeAt(0).cloneRange();
  }

  function restoreSelection(range) {
    if (!range || !state.editor) return;
    state.editor.surface.focus();
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function insertImageFromPicker() {
    var range = saveSelection();
    pickImage().then(function (url) {
      if (!url || !state.editor) return;
      restoreSelection(range);
      document.execCommand("insertImage", false, url);
      markDirty();
    });
  }

  // ---------------------------------------------------------------------------
  // Minimal, dependency-free HTML -> Markdown conversion
  // ---------------------------------------------------------------------------

  function escapeText(text) {
    return text
      .replace(/([\\`*_\[\]])/g, "\\$1")
      .replace(/^(\s*)([#>+-]|\d+\.)(\s)/gm, "$1\\$2$3");
  }

  function inlineCode(text) {
    var ticks = "`";
    while (text.indexOf(ticks) !== -1) ticks += "`";
    var pad = /^\s|\s$/.test(text) ? " " : "";
    return ticks + pad + text + pad + ticks;
  }

  function childrenToMarkdown(node) {
    var out = "";
    for (var i = 0; i < node.childNodes.length; i++) {
      out += nodeToMarkdown(node.childNodes[i]);
    }
    return out;
  }

  function renderCodeBlock(pre) {
    var codeEl = pre.querySelector("code");
    var source = codeEl || pre;
    var langMatch = /language-([\w-]+)/.exec(
      (codeEl && codeEl.className) || "",
    );
    var text = source.textContent.replace(/\n+$/, "");
    var fence = "```";
    while (text.indexOf(fence) !== -1) fence += "`";
    return (
      "\n\n" +
      fence +
      (langMatch ? langMatch[1] : "") +
      "\n" +
      text +
      "\n" +
      fence +
      "\n\n"
    );
  }

  function listToMarkdown(listEl, ordered, depth) {
    depth = depth || 0;
    var lines = [];
    var index = 1;
    var indent = new Array(depth + 1).join("  ");

    for (var i = 0; i < listEl.children.length; i++) {
      var li = listEl.children[i];
      if (li.tagName.toLowerCase() !== "li") continue;

      var inline = "";
      var nested = [];
      for (var j = 0; j < li.childNodes.length; j++) {
        var child = li.childNodes[j];
        if (child.nodeType === 1 && /^(ul|ol)$/i.test(child.tagName)) {
          nested.push(child);
        } else {
          inline += nodeToMarkdown(child);
        }
      }

      inline = inline.replace(/\n+/g, " ").trim();
      lines.push(indent + (ordered ? index + ". " : "- ") + inline);

      for (var k = 0; k < nested.length; k++) {
        lines.push(
          listToMarkdown(
            nested[k],
            nested[k].tagName.toLowerCase() === "ol",
            depth + 1,
          ),
        );
      }
      index++;
    }

    return "\n" + lines.join("\n") + "\n";
  }

  function renderTable(table) {
    var rows = table.querySelectorAll("tr");
    if (!rows.length) return "";

    var matrix = [];
    for (var i = 0; i < rows.length; i++) {
      var cells = rows[i].children;
      var row = [];
      for (var j = 0; j < cells.length; j++) {
        row.push(
          childrenToMarkdown(cells[j])
            .replace(/\n+/g, " ")
            .trim()
            .replace(/\|/g, "\\|"),
        );
      }
      matrix.push(row);
    }

    var header = matrix[0] || [];
    var lines = ["| " + header.join(" | ") + " |"];
    lines.push(
      "| " +
        header
          .map(function () {
            return "---";
          })
          .join(" | ") +
        " |",
    );
    for (var r = 1; r < matrix.length; r++) {
      lines.push("| " + matrix[r].join(" | ") + " |");
    }

    return "\n\n" + lines.join("\n") + "\n\n";
  }

  function nodeToMarkdown(node) {
    if (node.nodeType === 3) {
      return escapeText(node.nodeValue.replace(/\u00a0/g, " "));
    }
    if (node.nodeType !== 1) return "";

    var tag = node.tagName.toLowerCase();

    if (tag === "pre") return renderCodeBlock(node);
    if (tag === "ul") return listToMarkdown(node, false, 0);
    if (tag === "ol") return listToMarkdown(node, true, 0);
    if (tag === "table") return renderTable(node);

    var children = childrenToMarkdown(node);
    var trimmed = children.trim();

    switch (tag) {
      case "br":
        return "  \n";
      case "strong":
      case "b":
        return trimmed ? "**" + children + "**" : children;
      case "em":
      case "i":
        return trimmed ? "*" + children + "*" : children;
      case "del":
      case "s":
      case "strike":
        return trimmed ? "~~" + children + "~~" : children;
      case "code":
        return inlineCode(node.textContent);
      case "a": {
        var href = node.getAttribute("href") || "";
        var label = trimmed || href;
        return href ? "[" + label + "](" + href + ")" : label;
      }
      case "img": {
        var src = node.getAttribute("src") || "";
        var alt = node.getAttribute("alt") || "";
        return src ? "![" + alt + "](" + src + ")" : "";
      }
      case "h1":
        return "\n\n# " + trimmed + "\n\n";
      case "h2":
        return "\n\n## " + trimmed + "\n\n";
      case "h3":
        return "\n\n### " + trimmed + "\n\n";
      case "h4":
        return "\n\n#### " + trimmed + "\n\n";
      case "h5":
        return "\n\n##### " + trimmed + "\n\n";
      case "h6":
        return "\n\n###### " + trimmed + "\n\n";
      case "p":
      case "div":
        return "\n\n" + trimmed + "\n\n";
      case "blockquote": {
        if (!trimmed) return "";
        return (
          "\n\n" +
          trimmed
            .split("\n")
            .map(function (line) {
              return "> " + line;
            })
            .join("\n") +
          "\n\n"
        );
      }
      case "hr":
        return "\n\n---\n\n";
      default:
        return children;
    }
  }

  function collapseBlankLines(markdown) {
    var lines = markdown.split("\n");
    var output = [];
    var inFence = false;
    var blankRun = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\s*```/.test(line)) inFence = !inFence;

      if (!inFence && !line.trim()) {
        blankRun++;
        if (blankRun > 1) continue;
        output.push("");
        continue;
      }

      blankRun = 0;
      output.push(inFence ? line : line.replace(/[ \t]+$/, ""));
    }

    return output.join("\n").trim();
  }

  function serializeSurface(surface) {
    return collapseBlankLines(childrenToMarkdown(surface));
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts / unload guard
  // ---------------------------------------------------------------------------

  document.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      if (state.editor && state.draft) {
        event.preventDefault();
        saveItem();
      }
    }
  });

  window.addEventListener("beforeunload", function (event) {
    if (state.dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

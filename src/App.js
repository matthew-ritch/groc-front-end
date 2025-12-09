import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useParams, useNavigate } from "react-router-dom";
import "./App.css";
import QRCode from "react-qr-code";

// Simple JWT storage
function useAuth() {
  const [token, setToken] = React.useState(localStorage.getItem("jwt") || "");
  const saveToken = (t) => {
    setToken(t);
    localStorage.setItem("jwt", t);
  };
  const logout = () => {
    setToken("");
    localStorage.removeItem("jwt");
  };
  return { token, saveToken, logout };
}

function LoginPage() {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [isSignup, setIsSignup] = React.useState(false);
  const [error, setError] = React.useState("");
  const { saveToken } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (isSignup) {
      // Signup
      const res = await fetch("/api/users/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email }),
      });
      if (!res.ok) {
        setError("Signup failed");
        return;
      }
    }
    // Login
    const res = await fetch("/api/token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.access) {
      saveToken(data.access);
      navigate("/recipes");
    } else {
      setError("Login failed");
    }
  };

  return (
    <div className="container">
      <div className="main pageContainer">
        <h2>{isSignup ? "Sign Up" : "Login"}</h2>
        <form onSubmit={handleSubmit}>
          <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
          <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          {isSignup && (
            <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          )}
          <button type="submit">{isSignup ? "Sign Up" : "Login"}</button>
        </form>
        <button onClick={() => setIsSignup(!isSignup)}>
          {isSignup ? "Already have an account? Login" : "No account? Sign Up"}
        </button>
        {error && <div style={{ color: "red" }}>{error}</div>}
      </div>
    </div>
  );
}

function RecipesPage() {
  const { token, logout } = useAuth();
  const [recipes, setRecipes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Helper to reload recipes
  const loadRecipes = React.useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/grocery-lists/", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(lists => {
        if (!Array.isArray(lists) || lists.length === 0) {
          setRecipes([]);
          setLoading(false);
          return;
        }
        const listId = lists[0].id;
        fetch(`/api/grocery-list-recipes/?grocery_list=${listId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(listRecipes => {
            if (!Array.isArray(listRecipes) || listRecipes.length === 0) {
              setRecipes([]);
              setLoading(false);
              return;
            }
            const recipeIds = listRecipes.map(r => r.recipe).join(",");
            fetch(`/api/recipes/?ids=${recipeIds}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
              .then(res => res.json())
              .then(recipeDetails => {
                const detailsMap = {};
                recipeDetails.forEach(rd => { detailsMap[rd.id] = rd; });
                const merged = listRecipes.map(lr => ({
                  ...detailsMap[lr.recipe],
                  servings: lr.servings,
                  datetime_added: lr.datetime_added,
                  id: lr.id
                }));
                setRecipes(merged);
                setLoading(false);
              })
              .catch(() => {
                setError("Failed to load recipe details");
                setLoading(false);
              });
          })
          .catch(() => {
            setError("Failed to load grocery list recipes");
            setLoading(false);
          });
      })
      .catch(() => {
        setError("Failed to load grocery lists");
        setLoading(false);
      });
  }, [token]);

  React.useEffect(() => {
    loadRecipes();
  }, [token, loadRecipes]);

  // PATCH servings
  const changeServings = (entryId, newServings) => {
    fetch(`/api/grocery-list-recipes/${entryId}/`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ servings: newServings })
    })
      .then(res => {
        if (res.ok) loadRecipes();
      });
  };

  // DELETE entry
  const deleteEntry = (entryId) => {
    fetch(`/api/grocery-list-recipes/${entryId}/`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (res.ok) loadRecipes();
      });
  };

  return (
    <div className="container">
      <div className="main pageContainer">
        <h2>Current Recipes in Grocery List</h2>
        {loading && <div>Loading...</div>}
        {error && <div style={{ color: "red" }}>{error}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1em" }}>
          {recipes.map(r => (
            <div key={r.id} style={{ border: "1px solid #ccc", padding: "1em", borderRadius: "6px", minWidth: "200px" }}>
              <div><strong>{r.title || `Recipe #${r.id}`}</strong></div>
              <div>
                Servings: {r.servings}
                <button
                  style={{ marginLeft: "0.5em" }}
                  onClick={() => changeServings(r.id, Math.max(1, r.servings - 1))}
                  disabled={r.servings <= 1}
                  title="Decrease servings"
                >-</button>
                <button
                  style={{ marginLeft: "0.2em" }}
                  onClick={() => changeServings(r.id, r.servings + 1)}
                  title="Increase servings"
                >+</button>
              </div>
              <div style={{ fontSize: "0.9em", color: "#666" }}>Added: {r.datetime_added && new Date(r.datetime_added).toLocaleString()}</div>
              <button
                style={{ marginTop: "0.5em", background: "#f44336", color: "white", border: "none", borderRadius: "4px", padding: "0.3em 0.7em", cursor: "pointer" }}
                onClick={() => deleteEntry(r.id)}
                title="Delete entry"
              >Delete</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IngredientsPage() {
  const { token } = useAuth();
  const [items, setItems] = React.useState([]);
  React.useEffect(() => {
    fetch("/api/grocery-lists/", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(lists => {
        if (lists.length === 0) return setItems([]);
        const listId = lists[0].id;
        // Use new endpoint
        fetch(`/api/grocery_list_ingredients/?grocery_list_id=${listId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              setItems(data);
            } else {
              setItems([]);
            }
          });
      });
  }, [token]);
  const [checked, setChecked] = React.useState({});
  return (
    <div className="container">
      <div className="main pageContainer">
        <h2>Ingredients Needed</h2>
        <div>
          {items.map(item => (
            <div key={item.ingredient_id + "_" + item.unit} style={{ marginBottom: "0.5em" }}>
              <input
                type="checkbox"
                checked={!!checked[item.ingredient_id + "_" + item.unit]}
                onChange={() => setChecked(c => ({ ...c, [item.ingredient_id + "_" + item.unit]: !c[item.ingredient_id + "_" + item.unit] }))}
              />
              {item.ingredient_name} {item.quantity} {item.unit}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QRRecipePage({ recipeId, servings }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  React.useEffect(() => {
    fetch("/api/add_recipe_to_grocery_list/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ recipe_id: recipeId, servings: servings })
    })
      .then(res => res.json())
      .then(() => {
        setTimeout(() => navigate("/recipes"), 1000);
      });
  }, [recipeId, servings, token, navigate]);
  return (
    <div className="container">
      <div className="main pageContainer">
        Adding Recipe {recipeId} (servings: {servings})...
      </div>
    </div>
  );
}

function QRRecipeWrapper() {
  const { recipeId, servings } = useParams();
  return <QRRecipePage recipeId={recipeId} servings={servings} />;
}


function QRTestPage() {
  const { token } = useAuth();
  const [recipes, setRecipes] = React.useState([]);

  React.useEffect(() => {
    fetch("/api/recipes/", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRecipes(data);
        } else {
          setRecipes([]);
        }
      });
  }, [token]);

  // Generate QR code data (e.g., a URL or JSON payload)
  const getQrValue = (recipe) =>
    `http://192.168.4.23:3000/qr/${recipe.id}/1`;

  return (
    <div className="container">
      <div className="main pageContainer">
        <h2>QR Code Test Page</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2em" }}>
          {recipes.map(recipe => (
            <div key={recipe.id} style={{ border: "1px solid #ccc", padding: "1em" }}>
              <div><strong>{recipe.title}</strong></div>
              <QRCode
                value={getQrValue(recipe)}
                size={150}
              />
              <div>
                <Link to={`/qr/${recipe.id}/1`} className="txtlink">Add to Grocery List</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" />;
  return children;
}

function Navbar({ token, logout }) {
  return (
    <nav style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0.5em 1em",
      background: "#f7f7f7",
      borderBottom: "1px solid #ddd",
      marginBottom: "1em"
    }}>
      <div style={{ fontWeight: "bold", fontSize: "1.2em" }}>
        <Link to="/" style={{ textDecoration: "none", color: "#333" }}>Groc</Link>
      </div>
      <div style={{ display: "flex", gap: "1em" }}>
        <Link to="/recipes">Recipes</Link>
        <Link to="/ingredients">Ingredients</Link>
        <Link to="/qr-test">QR Test</Link>
        {!token && <Link to="/login">Login</Link>}
        {token && (
          <button onClick={logout} style={{ background: "none", border: "none", color: "#007bff", cursor: "pointer" }}>Logout</button>
        )}
      </div>
    </nav>
  );
}

function App() {
  const auth = useAuth();
  return (
    <Router>
      <Navbar token={auth.token} logout={auth.logout} />
      <Routes>
        <Route path="/recipes" element={
          <RequireAuth>
            <RecipesPage />
          </RequireAuth>
        } />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/ingredients" element={
          <RequireAuth>
            <IngredientsPage />
          </RequireAuth>
        } />
        <Route path="/qr/:recipeId/:servings" element={
          <RequireAuth>
            <QRRecipeWrapper />
          </RequireAuth>
        } />
        <Route path="/qr-test" element={
          <RequireAuth>
            <QRTestPage />
          </RequireAuth>
        } />
        <Route path="*" element={<Navigate to="/recipes" />} />
      </Routes>
    </Router>
  );
}

export default App;
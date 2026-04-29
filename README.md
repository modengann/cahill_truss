# Method of Joints Trainer

A static web app for learning the method of joints in structural analysis. Students predict whether each truss member is in tension or compression, then verify their predictions using equilibrium equations.

## Running locally

Open `index.html` in any browser. No server required.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository.
2. Go to **Settings → Pages**, set source to **Deploy from branch: main / (root)**.
3. The app will be live at `https://<username>.github.io/<repo-name>/`.

## Adding new problems

Edit `problems.json`. Each problem is an object with:

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique identifier |
| `name` | string | Display name in the dropdown |
| `joints` | array | Each joint: `{ id, x, y, support }` |
| `members` | array | Each member: `{ id, j1, j2 }` |
| `loads` | array | Applied forces: `{ joint, fx, fy }` in kN |
| `reactions` | array | Support reactions (precomputed): `{ joint, fx, fy }` in kN |
| `solutionOrder` | array | Joint IDs in solve order (used for replay) |

**Support types:** `"pin"` (fx+fy), `"roller"` (fy only), `"roller-horizontal"` (fx only), `"free"` (none).

**Coordinate system:** x = right, y = up. Forces in kN; positive = right/up.

**Reactions must be precomputed.** The solver uses them as known inputs.

### Example

```json
{
  "id": "simple",
  "name": "Simple Triangle",
  "joints": [
    { "id": "A", "x": 0, "y": 0, "support": "pin" },
    { "id": "B", "x": 4, "y": 0, "support": "roller" },
    { "id": "C", "x": 2, "y": 3, "support": "free" }
  ],
  "members": [
    { "id": "AC", "j1": "A", "j2": "C" },
    { "id": "BC", "j1": "B", "j2": "C" },
    { "id": "AB", "j1": "A", "j2": "B" }
  ],
  "loads": [{ "joint": "C", "fx": 0, "fy": -10 }],
  "reactions": [
    { "joint": "A", "fx": 0, "fy": 5 },
    { "joint": "B", "fx": 0, "fy": 5 }
  ],
  "solutionOrder": ["A", "B", "C"]
}
```

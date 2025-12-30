# Sauci Email Templates

Premium, on-brand email templates for Supabase authentication.

## Templates Included

| Template | Supabase Setting | Purpose |
|----------|------------------|---------|
| `confirmation.html` | Confirm signup | Email verification after user signs up |
| `magic-link.html` | Magic Link | Passwordless sign-in links |
| `password-reset.html` | Reset Password | Password recovery emails |
| `email-change.html` | Change Email Address | Confirm email address updates |
| `invite.html` | Invite user | Admin user invitations |

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. For each template:
   - Select the template type from the tabs
   - Copy the HTML content from the corresponding `.html` file
   - Paste into the **Body** field
   - Update the **Subject** field (suggestions below)
   - Click **Save**

### Option 2: Supabase CLI

```bash
# Update config.toml in supabase/config.toml
# Add template paths under [auth.email]
```

## Recommended Subject Lines

| Template | Subject Line |
|----------|-------------|
| Confirm signup | `Welcome to Sauci - Confirm Your Email` |
| Magic Link | `Your Sauci Sign In Link` |
| Reset Password | `Reset Your Sauci Password` |
| Change Email | `Confirm Your New Email Address - Sauci` |
| Invite user | `You've Been Invited to Sauci` |

## Template Variables

These templates use Supabase's Go template syntax:

- `{{ .ConfirmationURL }}` - The action URL (confirm, reset, sign in)
- `{{ .Email }}` - The user's email address (available but not used)
- `{{ .Token }}` - Raw token (available but not used)

## Design System

Templates match Sauci's premium glass-morphism aesthetic:

**Colors:**
- Primary: `#e94560` (Rose Pink)
- Secondary: `#9b59b6` (Purple)
- Background: `#0d0d1a` (Deep Dark)
- Surface: `#1a1a2e` / `#16213e`
- Text: `#ffffff` with varying opacity

**Features:**
- Gradient accent bar at top of cards
- Subtle border styling (rgba white 8%)
- Linear gradients for backgrounds
- Shadow effects on CTA buttons
- Responsive design for all devices
- Outlook/Windows Mail compatible

## Testing

1. Use Supabase's "Send test email" feature in the dashboard
2. Test on multiple email clients:
   - Gmail (web & mobile)
   - Apple Mail
   - Outlook
   - Yahoo Mail

## Customization

To customize for your needs:

1. **Logo**: Replace the text "Sauci" with an `<img>` tag if you have a logo image hosted
2. **Colors**: Find/replace the hex values to match any brand updates
3. **Copy**: Adjust the messaging to fit your tone

## Notes

- Templates use table-based layouts for maximum email client compatibility
- Inline styles are used (email clients strip `<style>` tags)
- Background gradients may not render in all clients; solid fallback colors are defined
- Test thoroughly before deploying to production

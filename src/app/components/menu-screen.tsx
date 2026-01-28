import { useState } from "react";
import { useNavigate } from "react-router";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";
import { ArrowLeft, Plus, Minus, ShoppingBag } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

const menuItems: MenuItem[] = [
  // Appetizers
  {
    id: "a1",
    name: "Bruschetta Trio",
    description: "Three varieties of toasted bread with fresh toppings",
    price: 12.99,
    image: "https://images.unsplash.com/photo-1768849352399-86a2fdbe226a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcHBldGl6ZXJzJTIwcGxhdHRlcnxlbnwxfHx8fDE3NjkwMzI0NTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "appetizers"
  },
  {
    id: "a2",
    name: "Crispy Calamari",
    description: "Lightly breaded squid with lemon aioli",
    price: 14.99,
    image: "https://images.unsplash.com/photo-1768849352399-86a2fdbe226a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcHBldGl6ZXJzJTIwcGxhdHRlcnxlbnwxfHx8fDE3NjkwMzI0NTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "appetizers"
  },
  {
    id: "a3",
    name: "Caesar Salad",
    description: "Crisp romaine with parmesan and croutons",
    price: 10.99,
    image: "https://images.unsplash.com/photo-1768849352399-86a2fdbe226a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcHBldGl6ZXJzJTIwcGxhdHRlcnxlbnwxfHx8fDE3NjkwMzI0NTF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "appetizers"
  },
  // Mains
  {
    id: "m1",
    name: "Grilled Salmon",
    description: "Atlantic salmon with seasonal vegetables",
    price: 28.99,
    image: "https://images.unsplash.com/photo-1761983723667-99c7fd98af53?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb3VybWV0JTIwbWFpbiUyMGNvdXJzZXxlbnwxfHx8fDE3NjkxNDQ2OTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "mains"
  },
  {
    id: "m2",
    name: "Ribeye Steak",
    description: "Prime 12oz ribeye with garlic butter",
    price: 38.99,
    image: "https://images.unsplash.com/photo-1761983723667-99c7fd98af53?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb3VybWV0JTIwbWFpbiUyMGNvdXJzZXxlbnwxfHx8fDE3NjkxNDQ2OTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "mains"
  },
  {
    id: "m3",
    name: "Mushroom Risotto",
    description: "Creamy arborio rice with wild mushrooms",
    price: 24.99,
    image: "https://images.unsplash.com/photo-1761983723667-99c7fd98af53?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb3VybWV0JTIwbWFpbiUyMGNvdXJzZXxlbnwxfHx8fDE3NjkxNDQ2OTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "mains"
  },
  {
    id: "m4",
    name: "Chicken Piccata",
    description: "Pan-seared chicken in lemon caper sauce",
    price: 26.99,
    image: "https://images.unsplash.com/photo-1761983723667-99c7fd98af53?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb3VybWV0JTIwbWFpbiUyMGNvdXJzZXxlbnwxfHx8fDE3NjkxNDQ2OTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "mains"
  },
  // Desserts
  {
    id: "d1",
    name: "Chocolate Lava Cake",
    description: "Warm chocolate cake with vanilla ice cream",
    price: 9.99,
    image: "https://images.unsplash.com/photo-1679942262057-d5732f732841?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNzZXJ0JTIwY2FrZXxlbnwxfHx8fDE3NjkwOTAzMTl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "desserts"
  },
  {
    id: "d2",
    name: "Tiramisu",
    description: "Classic Italian coffee-flavored dessert",
    price: 8.99,
    image: "https://images.unsplash.com/photo-1679942262057-d5732f732841?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNzZXJ0JTIwY2FrZXxlbnwxfHx8fDE3NjkwOTAzMTl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "desserts"
  },
  {
    id: "d3",
    name: "Crème Brûlée",
    description: "Vanilla custard with caramelized sugar",
    price: 8.99,
    image: "https://images.unsplash.com/photo-1679942262057-d5732f732841?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNzZXJ0JTIwY2FrZXxlbnwxfHx8fDE3NjkwOTAzMTl8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "desserts"
  },
  // Beverages
  {
    id: "b1",
    name: "Fresh Lemonade",
    description: "House-made with organic lemons",
    price: 4.99,
    image: "https://images.unsplash.com/photo-1652922664558-03d0f2932e58?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZXZlcmFnZXMlMjBkcmlua3N8ZW58MXx8fHwxNzY5MDU4NDIxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "beverages"
  },
  {
    id: "b2",
    name: "Espresso",
    description: "Rich Italian espresso",
    price: 3.99,
    image: "https://images.unsplash.com/photo-1652922664558-03d0f2932e58?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZXZlcmFnZXMlMjBkcmlua3N8ZW58MXx8fHwxNzY5MDU4NDIxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "beverages"
  },
  {
    id: "b3",
    name: "Sparkling Water",
    description: "San Pellegrino sparkling water",
    price: 3.99,
    image: "https://images.unsplash.com/photo-1652922664558-03d0f2932e58?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZXZlcmFnZXMlMjBkcmlua3N8ZW58MXx8fHwxNzY5MDU4NDIxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "beverages"
  }
];

const categories = [
  { id: "appetizers", name: "Appetizers" },
  { id: "mains", name: "Main Courses" },
  { id: "desserts", name: "Desserts" },
  { id: "beverages", name: "Beverages" }
];

export function MenuScreen() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("appetizers");
  const [cart, setCart] = useState<CartItem[]>([]);

  const filteredItems = menuItems.filter(
    (item) => item.category === selectedCategory
  );

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0);
    });
  };

  const getItemQuantity = (id: string) => {
    return cart.find((item) => item.id === id)?.quantity || 0;
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const handlePlaceOrder = () => {
    if (cart.length > 0) {
      alert(`주문이 완료되었습니다!\n총 ${totalItems}개 항목\n총액: $${totalPrice.toFixed(2)}`);
      setCart([]);
      navigate("/");
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Categories */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>홈으로</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <nav className="p-4">
            <h2 className="px-4 mb-2 text-xs uppercase tracking-wider text-gray-500">
              카테고리
            </h2>
            <div className="space-y-1">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    selectedCategory === category.id
                      ? "bg-gray-900 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm px-8 py-6">
          <h1 className="text-gray-900">
            {categories.find(c => c.id === selectedCategory)?.name}
          </h1>
        </header>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-32">
            {filteredItems.map((item) => {
              const quantity = getItemQuantity(item.id);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div 
                    className="relative h-48 cursor-pointer"
                    onClick={() => addToCart(item)}
                  >
                    <ImageWithFallback
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    {quantity > 0 && (
                      <div className="absolute top-2 right-2 bg-gray-900 text-white px-3 py-1 rounded-full text-sm">
                        {quantity}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-gray-900">{item.name}</h3>
                      <span className="text-gray-900">${item.price.toFixed(2)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                    
                    {quantity === 0 ? (
                      <button
                        onClick={() => addToCart(item)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>추가</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-4 py-2 text-center min-w-[60px]">{quantity}</span>
                        <button
                          onClick={() => addToCart(item)}
                          className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fixed Bottom Order Button */}
        {totalItems > 0 && (
          <div className="fixed bottom-0 right-0 left-64 bg-white border-t border-gray-200 shadow-lg px-8 py-6">
            <div className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-gray-600" />
                  <span className="text-gray-600">{totalItems}개 항목</span>
                </div>
                <div className="text-gray-900">
                  총액: ${totalPrice.toFixed(2)}
                </div>
              </div>
              <button
                onClick={handlePlaceOrder}
                className="px-8 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                주문하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}